import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { ensureAnnotationTable, prisma } from '@/lib/prisma';
import { CATEGORY_OPTIONS, UNIT_OPTIONS } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type DrawMode = 'point' | 'stroke';
type DrawPoint = { x: number; y: number };

const parseStrokePoints = (raw: unknown): DrawPoint[] | null => {
  if (typeof raw !== 'string') {
    return null;
  }

  try {
    const json = JSON.parse(raw) as unknown;
    if (!Array.isArray(json) || json.length < 2) {
      return null;
    }

    const points = json
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }
        const x = Number((item as { x?: unknown }).x);
        const y = Number((item as { y?: unknown }).y);
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
          return null;
        }
        return { x, y };
      })
      .filter((item): item is DrawPoint => item !== null);

    if (points.length < 2) {
      return null;
    }

    return points;
  } catch {
    return null;
  }
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  await ensureAnnotationTable();

  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const page = Number(body.page);
    const xRaw = Number(body.x);
    const yRaw = Number(body.y);
    const value = Number(body.value);
    const unit = String(body.unit);
    const category = String(body.category);
    const comment = String(body.comment ?? '');
    const modeRaw = String(body.mode ?? 'point');
    const mode = modeRaw === 'stroke' ? 'stroke' : modeRaw === 'point' ? 'point' : null;
    const parsedStroke = mode === 'stroke' ? parseStrokePoints(body.points) : null;

    if (!Number.isInteger(page) || page < 1) {
      return NextResponse.json({ error: 'Invalid page' }, { status: 400 });
    }

    if (!mode) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }

    if (!Number.isFinite(value)) {
      return NextResponse.json({ error: 'Invalid value' }, { status: 400 });
    }

    if (mode === 'point' && ![xRaw, yRaw].every((item) => Number.isFinite(item))) {
      return NextResponse.json({ error: 'Invalid point coordinates' }, { status: 400 });
    }

    if (mode === 'stroke' && !parsedStroke) {
      return NextResponse.json({ error: 'Invalid stroke points' }, { status: 400 });
    }

    if (!CATEGORY_OPTIONS.includes(category as (typeof CATEGORY_OPTIONS)[number])) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    if (!UNIT_OPTIONS.includes(unit as (typeof UNIT_OPTIONS)[number])) {
      return NextResponse.json({ error: 'Invalid unit' }, { status: 400 });
    }

    const [x, y] =
      mode === 'stroke' && parsedStroke
        ? [
            parsedStroke.reduce((sum, p) => sum + p.x, 0) / parsedStroke.length,
            parsedStroke.reduce((sum, p) => sum + p.y, 0) / parsedStroke.length
          ]
        : [xRaw, yRaw];

    const annotation = await prisma.annotation.update({
      where: { id },
      data: {
        page,
        x,
        y,
        mode: mode as DrawMode,
        points: mode === 'stroke' && parsedStroke ? JSON.stringify(parsedStroke) : null,
        value,
        unit,
        category,
        comment
      }
    });

    return NextResponse.json(annotation);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  await ensureAnnotationTable();

  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    await prisma.annotation.delete({
      where: { id }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Delete failed' }, { status: 400 });
  }
}
