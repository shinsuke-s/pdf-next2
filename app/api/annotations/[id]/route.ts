import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CATEGORY_OPTIONS, UNIT_OPTIONS } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

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

    const annotation = await prisma.annotation.update({
      where: { id },
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

    return NextResponse.json(annotation);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
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
