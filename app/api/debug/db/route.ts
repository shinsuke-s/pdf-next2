import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const hasSupabaseUrl = Boolean(process.env.SUPABASE_URL);
  const hasSupabaseServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const annotationsTable = process.env.SUPABASE_ANNOTATIONS_TABLE || 'annotations';
  const eventsTable = process.env.SUPABASE_ANNOTATION_EVENTS_TABLE || 'annotation_events';

  const mode = hasSupabaseUrl && hasSupabaseServiceRoleKey ? 'supabase' : 'sqlite_fallback';

  return NextResponse.json(
    {
      mode,
      env: {
        hasSupabaseUrl,
        hasSupabaseServiceRoleKey,
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL)
      },
      tables: {
        annotations: annotationsTable,
        events: eventsTable
      }
    },
    {
      headers: { 'Cache-Control': 'no-store' }
    }
  );
}
