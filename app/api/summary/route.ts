import { NextResponse } from 'next/server';
import { listAnnotations } from '@/lib/annotation-repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const annotations = await listAnnotations();
  const map = new Map<string, { category: string; unit: string; total: number }>();

  annotations.forEach((item) => {
    const key = `${item.category}__${item.unit}`;
    const current = map.get(key);
    if (current) {
      current.total += item.value;
      return;
    }
    map.set(key, {
      category: item.category,
      unit: item.unit,
      total: item.value
    });
  });

  const summary = Array.from(map.values()).sort((a, b) => {
    const byCategory = a.category.localeCompare(b.category, 'ja');
    if (byCategory !== 0) {
      return byCategory;
    }
    return a.unit.localeCompare(b.unit, 'ja');
  });

  return NextResponse.json(summary, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
