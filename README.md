# Money Pilot PB Recommendation App

사회초년생을 위한 목적 기반 PB 추천 웹앱 구조입니다.

## Structure

```text
frontend/
  React + Vite + TypeScript
  Tailwind CSS
  Supabase SDK client

backend/
  supabase/
    migrations/   PostgreSQL schema + RLS policy

vercel.json       Vercel frontend/dist deployment config
```

## Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

`frontend/.env.local`에는 Supabase 프로젝트 정보를 넣습니다.

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Backend

Supabase CLI를 사용하는 경우:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

초기 DB 구조와 RLS 정책은 `backend/supabase/migrations`에 있습니다. 실제 프로젝트 연결 후 Supabase CLI 설정을 루트 또는 `backend/supabase` 기준으로 맞추면 됩니다.

## Deployment

Vercel은 GitHub `main` 브랜치 push 시 다음 설정으로 `frontend/dist`를 배포하도록 구성되어 있습니다.

- install: `cd frontend && npm install`
- build: `cd frontend && npm run build`
- output: `frontend/dist`

