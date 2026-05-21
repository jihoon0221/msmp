# Money Pilot

React + Vite + Tailwind CSS 프론트엔드, Supabase 백엔드 대체 서비스, Vercel 배포 구조입니다.

## Structure

- `frontend`: React/Vite/Tailwind 웹앱
- `backend/supabase`: Supabase 설정, 마이그레이션, Edge Functions 자리
- `vercel.json`: Vercel에서 `frontend`를 빌드/배포하는 설정

## Frontend

```sh
cd frontend
npm install
npm run dev
```

Supabase 연결 값은 `frontend/.env`에 둡니다. `frontend/.env.example`을 기준으로 설정하세요.

## Backend

Supabase CLI를 쓰는 경우:

```sh
cd backend/supabase
supabase start
supabase db reset
```
# msmp
# msmp
