# PDF UI Prototype (Next.js + Docker + Prisma/SQLite + Supabase)

PDF上クリック座標取得・コメント配置・カテゴリ集計を確認するためのプロトタイプです。

## Stack

- Next.js (App Router)
- React
- TailwindCSS
- react-pdf
- Prisma + SQLite (ローカル開発向け)
- Supabase (Vercel永続化向け)
- Next.js API Routes
- Docker / docker-compose

## Setup (Docker)

```bash
docker compose up --build
```

ブラウザ: `http://localhost:3000`

## Environment

`.env` を作成する場合は以下を利用:

```env
DATABASE_URL="file:./prisma/dev.db"
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
SUPABASE_ANNOTATIONS_TABLE="annotations"
SUPABASE_ANNOTATION_EVENTS_TABLE="annotation_events"
```

- `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` が設定されている場合は Supabase を優先して使用します。
- 未設定の場合は従来どおり Prisma + SQLite を使用します。

## API

- `GET /api/annotations` 保存済み注釈一覧
- `POST /api/annotations` 注釈保存
- `PATCH /api/annotations/:id` 注釈更新（数値・位置・コメント等）
- `DELETE /api/annotations/:id` 注釈削除
- `GET /api/summary` カテゴリ別集計
- `GET /api/history?limit=50` 編集履歴（create/update/delete）

## Supabase セットアップ（推奨）

1. Supabase の SQL Editor で [`supabase/schema.sql`](supabase/schema.sql) を実行
2. Vercel の Environment Variables に以下を設定

```env
SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
SUPABASE_ANNOTATIONS_TABLE="annotations"
SUPABASE_ANNOTATION_EVENTS_TABLE="annotation_events"
```

注意:
- `SUPABASE_SERVICE_ROLE_KEY` はサーバー専用です。`NEXT_PUBLIC_` 付きで公開しないでください。
- このプロジェクトでは API Route (server side) からのみ Supabase に接続します。
- 編集操作は `annotation_events` テーブルに履歴として記録されます。

履歴確認SQL（Supabase SQL Editor）:

```sql
select
  id,
  annotation_id,
  action,
  before_data,
  after_data,
  created_at
from public.annotation_events
order by created_at desc
limit 100;
```

## VercelでSQLiteを使う場合（非推奨）

Supabase未設定時は SQLite が使われますが、Vercelでは `/tmp` の一時領域になるため永続化されません。

```env
DATABASE_URL="file:/tmp/dev.db"
```
