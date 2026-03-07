import { NextRequest, NextResponse } from 'next/server';
import { ensureAnnotationTable, prisma } from '@/lib/prisma';
import { CATEGORY_OPTIONS, UNIT_OPTIONS } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureAnnotationTable();

  const annotations = await prisma.annotation.findMany({
    orderBy: [{ createdAt: 'asc' }]
  });

  return NextResponse.json(annotations, {
    headers: { 'Cache-Control': 'no-store' }
  });
}

export async function POST(request: NextRequest) {
  await ensureAnnotationTable();

  try {
    const body = await request.json();
    const page = Number(body.page);
    const x = Number(body.x);
    const y = Number(body.y);
    const value = Number(body.value);
    const unit = String(body.unit);
    const category = String(body.category);
    const comment = String(body.comment ?? '');

    if (!Number.isInteger(page) || page < 1) {
      return NextResponse.json({ error: 'Invalid page' }, { status: 400 });
    }

    if (![x, y, value].every((item) => Number.isFinite(item))) {
      return NextResponse.json({ error: 'Invalid number fields' }, { status: 400 });
    }

    if (!CATEGORY_OPTIONS.includes(category as (typeof CATEGORY_OPTIONS)[number])) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    if (!UNIT_OPTIONS.includes(unit as (typeof UNIT_OPTIONS)[number])) {
      return NextResponse.json({ error: 'Invalid unit' }, { status: 400 });
    }

    const annotation = await prisma.annotation.create({
      data: {
        page,
        x,
        y,
        value,
        unit,
        category,
        comment
      }
    });

    return NextResponse.json(annotation, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to save annotation' }, { status: 500 });
  }
}
