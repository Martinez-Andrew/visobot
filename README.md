# Visobot MVP

Visobot is a web-first "Notion for LLM interaction" workspace.

It gives users one place to connect LLM providers, manage chats/GPTs/instructions/files/agents, auto-organize everything by topic, and recover old work through hybrid search.

## Stack

- Next.js 15 + TypeScript + Tailwind
- Supabase (Auth, Postgres, Storage, pgvector)
- Inngest (background jobs)
- Stripe (billing)
- Upstash (rate limiting)
- Sentry + PostHog (observability)

## Implemented MVP Features

- LLM connections API (`openai`, `anthropic`) with encrypted key storage
- Chat threads and message persistence
- File import (`.md`, `.txt`, `.json`)
- Automatic topic bucketing pipeline
- Global hybrid search (keyword + vector when embeddings are available)
- Notion-style workspace UI (`/app`)
- Billing checkout + webhook handlers
- Data export and hard-delete endpoints
- Supabase migration with RLS policies

## Quick Start

1. Install dependencies.

```bash
npm install
```

2. Copy env template.

```bash
cp .env.example .env.local
```

3. Set required values in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY_BASE64` (32-byte base64 key)

4. Apply Supabase migration:

```bash
supabase db push
```

5. Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## API Surface

- `POST /api/llm-connections`
- `GET /api/topics/tree`
- `GET /api/items`
- `POST /api/items`
- `POST /api/chats`
- `GET /api/chats/:threadId/messages`
- `POST /api/chats/:threadId/messages`
- `POST /api/imports`
- `GET /api/search?q=`
- `POST /api/billing/checkout`
- `POST /api/billing/webhook`
- `GET /api/account/export`
- `POST /api/account/delete`

## Important Notes

- For local development without auth plumbing, set `DEV_BYPASS_AUTH=true` and use `DEV_USER_ID`.
- In production, keep `DEV_BYPASS_AUTH=false` and require real Supabase user JWTs.
- Graph/node visualization is intentionally not shipped in MVP and uses `item_edges` for Milestone 2.

## Testing

```bash
npm run test
npm run test:e2e
```

## Deployment

- Deploy app to Vercel.
- Host database/auth on Supabase (same region as Vercel).
- Point Stripe webhook to `/api/billing/webhook`.
- Point Inngest to `/api/inngest`.

## Suggested Production Hardening

- Add CSP headers and stricter API auth middleware.
- Add Stripe customer portal endpoint.
- Add per-plan usage metering tables and enforcement jobs.
- Add full onboarding wizard copy for non-technical BYOK setup.
