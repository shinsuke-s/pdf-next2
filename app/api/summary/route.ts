import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const grouped = await prisma.annotation.groupBy({
    by: ['category', 'unit'],
    _sum: {
      value: true
    },
    orderBy: [{ category: 'asc' }, { unit: 'asc' }]
  });

  const summary = grouped.map((item) => ({
    category: item.category,
    unit: item.unit,
    total: item._sum.value ?? 0
  }));

  return NextResponse.json(summary, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
