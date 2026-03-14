import { NextRequest, NextResponse } from 'next/server';
import { listAnnotationEvents } from '@/lib/annotation-repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = limitParam ? Number(limitParam) : 50;
  const events = await listAnnotationEvents(Number.isFinite(limit) ? limit : 50);

  return NextResponse.json(events, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
