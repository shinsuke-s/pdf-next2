# PDF UI Prototype (Next.js + Docker + Prisma + SQLite)

PDF上クリック座標取得・コメント配置・カテゴリ集計を確認するためのプロトタイプです。

## Stack

- Next.js (App Router)
- React
- TailwindCSS
- react-pdf
- Prisma + SQLite
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
```

## API

- `GET /api/annotations` 保存済み注釈一覧
- `POST /api/annotations` 注釈保存
- `PATCH /api/annotations/:id` 注釈更新（数値・位置・コメント等）
- `DELETE /api/annotations/:id` 注釈削除
- `GET /api/summary` カテゴリ別集計

## Vercelでの確認について

この構成はVercelでも動かせますが、SQLiteは永続ストレージではないためデータは永続化されません。
検証用途としては、Vercel環境変数 `DATABASE_URL` を以下に設定してください。

```env
DATABASE_URL="file:/tmp/dev.db"
```

※ `/tmp` はインスタンスごとの一時領域のため、再デプロイ・スケール時にデータは失われます。
