import { NextRequest, NextResponse } from 'next/server';
import { createAnnotation, listAnnotations } from '@/lib/annotation-repository';
import { CATEGORY_OPTIONS, UNIT_OPTIONS } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

export async function GET() {
  const annotations = await listAnnotations();

  return NextResponse.json(annotations, {
    headers: { 'Cache-Control': 'no-store' }
  });
}

export async function POST(request: NextRequest) {
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

    if (![xRaw, yRaw].every((item) => Number.isFinite(item))) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    if (![xRaw, yRaw].every((item) => item >= 0 && item <= 1)) {
      return NextResponse.json({ error: 'Coordinates must be between 0 and 1' }, { status: 400 });
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

    const annotation = await createAnnotation({
      page,
      x: xRaw,
      y: yRaw,
      mode: mode as DrawMode,
      points: mode === 'stroke' && parsedStroke ? JSON.stringify(parsedStroke) : null,
      value,
      unit,
      category,
      comment
    });

    return NextResponse.json(annotation, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to save annotation' }, { status: 500 });
  }
}
