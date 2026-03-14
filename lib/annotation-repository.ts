import { ensureAnnotationTable, prisma } from '@/lib/prisma';

export type AnnotationRecord = {
  id: number;
  page: number;
  x: number;
  y: number;
  mode: string;
  points: string | null;
  value: number;
  unit: string;
  category: string;
  comment: string;
  createdAt: string;
};

export type AnnotationWriteInput = {
  page: number;
  x: number;
  y: number;
  mode: string;
  points: string | null;
  value: number;
  unit: string;
  category: string;
  comment: string;
};

export type AnnotationEventAction = 'create' | 'update' | 'delete';

export type AnnotationEventRecord = {
  id: number;
  annotationId: number | null;
  action: string;
  beforeData: unknown | null;
  afterData: unknown | null;
  createdAt: string;
};

export class AnnotationNotFoundError extends Error {
  constructor(message = 'Annotation not found') {
    super(message);
    this.name = 'AnnotationNotFoundError';
  }
}

const hasSupabaseEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseTable = process.env.SUPABASE_ANNOTATIONS_TABLE || 'annotations';
const supabaseEventsTable = process.env.SUPABASE_ANNOTATION_EVENTS_TABLE || 'annotation_events';

type SupabaseRow = {
  id: number;
  page: number;
  x: number;
  y: number;
  mode: string;
  points: string | null;
  value: number;
  unit: string;
  category: string;
  comment: string;
  created_at: string;
};

type SupabaseEventRow = {
  id: number;
  annotation_id: number | null;
  action: string;
  before_data: unknown | null;
  after_data: unknown | null;
  created_at: string;
};

type PrismaEventRow = {
  id: number;
  annotationId: number | null;
  action: string;
  beforeData: string | null;
  afterData: string | null;
  createdAt: Date | string;
};

const toNumber = (value: unknown): number => Number(value);

const parseJsonSafe = (raw: string | null): unknown | null => {
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const toAnnotationRecord = (row: SupabaseRow): AnnotationRecord => ({
  id: toNumber(row.id),
  page: toNumber(row.page),
  x: toNumber(row.x),
  y: toNumber(row.y),
  mode: String(row.mode ?? 'point'),
  points: row.points === null ? null : String(row.points),
  value: toNumber(row.value),
  unit: String(row.unit),
  category: String(row.category),
  comment: String(row.comment ?? ''),
  createdAt: String(row.created_at)
});

const toAnnotationEventRecord = (row: SupabaseEventRow): AnnotationEventRecord => ({
  id: toNumber(row.id),
  annotationId: row.annotation_id === null ? null : toNumber(row.annotation_id),
  action: String(row.action),
  beforeData: row.before_data,
  afterData: row.after_data,
  createdAt: String(row.created_at)
});

const toAnnotationEventRecordFromPrisma = (row: PrismaEventRow): AnnotationEventRecord => ({
  id: toNumber(row.id),
  annotationId: row.annotationId === null ? null : toNumber(row.annotationId),
  action: String(row.action),
  beforeData: parseJsonSafe(row.beforeData),
  afterData: parseJsonSafe(row.afterData),
  createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt)
});

const toSupabasePayload = (input: AnnotationWriteInput) => ({
  page: input.page,
  x: input.x,
  y: input.y,
  mode: input.mode,
  points: input.points,
  value: input.value,
  unit: input.unit,
  category: input.category,
  comment: input.comment
});

const encodeQueryValue = (value: string | number) => encodeURIComponent(String(value));

const supabaseRequest = async (path: string, init?: RequestInit) => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase environment variables are missing');
  }

  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${errorText}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

const normalizeRows = <T>(raw: unknown): T[] => {
  if (Array.isArray(raw)) {
    return raw as T[];
  }
  if (raw && typeof raw === 'object') {
    return [raw as T];
  }
  return [];
};

const getOneFromSupabase = async (id: number) => {
  const raw = await supabaseRequest(`${supabaseTable}?id=eq.${encodeQueryValue(id)}&select=*&limit=1`);
  const rows = normalizeRows<SupabaseRow>(raw);
  const row = rows[0];
  return row ? toAnnotationRecord(row) : null;
};

const appendEventOnSupabase = async (
  annotationId: number | null,
  action: AnnotationEventAction,
  beforeData: AnnotationRecord | null,
  afterData: AnnotationRecord | null
) => {
  try {
    await supabaseRequest(supabaseEventsTable, {
      method: 'POST',
      headers: {
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        annotation_id: annotationId,
        action,
        before_data: beforeData,
        after_data: afterData
      })
    });
  } catch (error) {
    console.error('Failed to append annotation event on Supabase', error);
  }
};

const listFromSupabase = async () => {
  const raw = await supabaseRequest(`${supabaseTable}?select=*&order=created_at.asc`);
  const rows = normalizeRows<SupabaseRow>(raw);
  return rows.map(toAnnotationRecord);
};

const createOnSupabase = async (input: AnnotationWriteInput) => {
  const raw = await supabaseRequest(supabaseTable, {
    method: 'POST',
    headers: {
      Prefer: 'return=representation'
    },
    body: JSON.stringify(toSupabasePayload(input))
  });

  const rows = normalizeRows<SupabaseRow>(raw);
  const row = rows[0];
  if (!row) {
    throw new Error('Supabase insert returned no row');
  }

  const created = toAnnotationRecord(row);
  await appendEventOnSupabase(created.id, 'create', null, created);
  return created;
};

const updateOnSupabase = async (id: number, input: AnnotationWriteInput) => {
  const before = await getOneFromSupabase(id);
  if (!before) {
    throw new AnnotationNotFoundError();
  }

  const raw = await supabaseRequest(`${supabaseTable}?id=eq.${encodeQueryValue(id)}`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation'
    },
    body: JSON.stringify(toSupabasePayload(input))
  });

  const rows = normalizeRows<SupabaseRow>(raw);
  const row = rows[0];
  if (!row) {
    throw new AnnotationNotFoundError();
  }

  const updated = toAnnotationRecord(row);
  await appendEventOnSupabase(id, 'update', before, updated);
  return updated;
};

const deleteOnSupabase = async (id: number) => {
  const before = await getOneFromSupabase(id);
  if (!before) {
    throw new AnnotationNotFoundError();
  }

  const raw = await supabaseRequest(`${supabaseTable}?id=eq.${encodeQueryValue(id)}`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=representation'
    }
  });

  const rows = normalizeRows<SupabaseRow>(raw);
  if (!rows[0]) {
    throw new AnnotationNotFoundError();
  }

  await appendEventOnSupabase(id, 'delete', before, null);
};

const appendEventOnPrisma = async (
  annotationId: number | null,
  action: AnnotationEventAction,
  beforeData: AnnotationRecord | null,
  afterData: AnnotationRecord | null
) => {
  await ensureAnnotationTable();
  await prisma.$executeRaw`
    INSERT INTO "AnnotationEvent" ("annotationId", "action", "beforeData", "afterData")
    VALUES (${annotationId}, ${action}, ${beforeData ? JSON.stringify(beforeData) : null}, ${afterData ? JSON.stringify(afterData) : null})
  `;
};

const listEventsFromSupabase = async (limit: number) => {
  try {
    const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
    const raw = await supabaseRequest(`${supabaseEventsTable}?select=*&order=created_at.desc&limit=${safeLimit}`);
    const rows = normalizeRows<SupabaseEventRow>(raw);
    return rows.map(toAnnotationEventRecord);
  } catch (error) {
    console.error('Failed to list annotation events on Supabase', error);
    return [];
  }
};

const listFromPrisma = async () => {
  await ensureAnnotationTable();
  return prisma.annotation.findMany({
    orderBy: [{ createdAt: 'asc' }]
  });
};

const createOnPrisma = async (input: AnnotationWriteInput) => {
  await ensureAnnotationTable();
  const created = await prisma.annotation.create({ data: input });
  await appendEventOnPrisma(created.id, 'create', null, {
    ...created,
    createdAt: created.createdAt.toISOString()
  });
  return created;
};

const updateOnPrisma = async (id: number, input: AnnotationWriteInput) => {
  await ensureAnnotationTable();
  const before = await prisma.annotation.findUnique({ where: { id } });
  if (!before) {
    throw new AnnotationNotFoundError();
  }

  const updated = await prisma.annotation.update({
    where: { id },
    data: input
  });
  await appendEventOnPrisma(
    id,
    'update',
    {
      ...before,
      createdAt: before.createdAt.toISOString()
    },
    {
      ...updated,
      createdAt: updated.createdAt.toISOString()
    }
  );
  return updated;
};

const deleteOnPrisma = async (id: number) => {
  await ensureAnnotationTable();
  const before = await prisma.annotation.findUnique({ where: { id } });
  if (!before) {
    throw new AnnotationNotFoundError();
  }

  await prisma.annotation.delete({ where: { id } });
  await appendEventOnPrisma(
    id,
    'delete',
    {
      ...before,
      createdAt: before.createdAt.toISOString()
    },
    null
  );
};

const listEventsFromPrisma = async (limit: number) => {
  await ensureAnnotationTable();
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  const rows = await prisma.$queryRaw<PrismaEventRow[]>`
    SELECT "id", "annotationId", "action", "beforeData", "afterData", "createdAt"
    FROM "AnnotationEvent"
    ORDER BY "createdAt" DESC
    LIMIT ${safeLimit}
  `;
  return rows.map(toAnnotationEventRecordFromPrisma);
};

export async function listAnnotations() {
  return hasSupabaseEnv ? listFromSupabase() : listFromPrisma();
}

export async function createAnnotation(input: AnnotationWriteInput) {
  return hasSupabaseEnv ? createOnSupabase(input) : createOnPrisma(input);
}

export async function updateAnnotation(id: number, input: AnnotationWriteInput) {
  return hasSupabaseEnv ? updateOnSupabase(id, input) : updateOnPrisma(id, input);
}

export async function deleteAnnotation(id: number) {
  return hasSupabaseEnv ? deleteOnSupabase(id) : deleteOnPrisma(id);
}

export async function listAnnotationEvents(limit = 50) {
  return hasSupabaseEnv ? listEventsFromSupabase(limit) : listEventsFromPrisma(limit);
}
