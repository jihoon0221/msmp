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

## Team Test Guide

아래 순서대로 하면 로컬 컴퓨터에서 앱을 테스트할 수 있습니다.

### 1. 처음 한 번만 준비

프로젝트 폴더로 이동합니다.

```bash
cd /Users/hoon/Desktop/pb
```

프론트엔드 폴더로 이동해서 필요한 패키지를 설치합니다.

```bash
cd frontend
npm install
```

환경변수 파일을 만듭니다.

```bash
cp .env.example .env.local
```

`frontend/.env.local` 파일을 열고 아래 값을 채웁니다.

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=https://<supabase-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<supabase-publishable-key>
```

팀원이 직접 Supabase를 설치할 필요는 없습니다. 이미 연결된 Supabase 프로젝트를 같이 쓰면 됩니다.

### 2. 실행할 때마다 하는 것

프론트엔드 폴더에서 실행합니다.

```bash
cd /Users/hoon/Desktop/pb/frontend
npm run dev
```

터미널에 이런 주소가 뜹니다.

```text
http://127.0.0.1:5173/
```

브라우저에서 그 주소로 들어갑니다. 만약 `5174`처럼 다른 번호가 뜨면, 터미널에 나온 주소를 그대로 사용하면 됩니다.

### 3. 테스트 순서

1. 회원가입 또는 로그인합니다.
2. 첫 화면에서 목표 금액, 기간, 월급, 지출, 투자성향을 입력합니다.
3. `시나리오연산 & AI자산배분` 버튼을 누릅니다.
4. 홈 대시보드가 뜨는지 확인합니다.
5. 아래 탭에서 `자산현황`으로 이동합니다.
6. `보유자산 추가`를 누릅니다.
7. 주식/ETF, 예금/적금, 채권 중 하나를 입력합니다.
8. 주식/ETF는 종목명을 검색해서 선택합니다.
9. 저장 후 자산 목록과 홈 차트가 바뀌는지 확인합니다.

현재 추천 기능은 실제 AI가 아니라 임시 템플릿입니다. 백엔드 서버가 꺼져 있어도 버튼을 누르면 로컬 템플릿으로 넘어가게 되어 있습니다.

현재 가격 조회도 실제 시세가 아니라 mock 가격입니다. Twelve Data 또는 EODHD API Key는 아직 필요 없습니다.

### 4. 자주 나는 문제

`Failed to fetch`가 로그인 화면에서 뜨는 경우:

- `frontend/.env.local`의 Supabase URL과 publishable key가 맞는지 확인합니다.
- `.env.local`을 수정했다면 `npm run dev`를 껐다가 다시 켭니다.

`Email not confirmed`가 뜨는 경우:

- Supabase 이메일 인증이 켜져 있는 상태입니다.
- 테스트 단계에서는 Supabase Dashboard에서 `Authentication > Providers > Email > Confirm email` 옵션을 끄면 편합니다.
- 이미 만든 테스트 계정은 삭제 후 다시 가입하는 것이 빠릅니다.

종목 검색 결과가 안 뜨는 경우:

- Supabase `stocks` 테이블에 `stocks_seed_400.csv`가 import되어 있는지 확인합니다.
- 로그인 상태인지 확인합니다.

자산 저장이 안 되는 경우:

- 로그인 상태인지 확인합니다.
- Supabase migration이 적용되어 있는지 확인합니다.
- `get-stock-price` Edge Function이 배포되어 있는지 확인합니다.

### 5. 팀원이 설치하지 않아도 되는 것

일반 테스트만 할 때는 아래 항목이 필요 없습니다.

- Supabase CLI
- Docker
- Twelve Data API Key
- EODHD API Key
- AI API Key

Supabase CLI는 DB migration을 새로 적용하거나 Edge Function을 다시 배포하는 사람만 필요합니다.

## Backend

Supabase CLI를 사용하는 경우:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

초기 DB 구조와 RLS 정책은 `backend/supabase/migrations`에 있습니다. 실제 프로젝트 연결 후 Supabase CLI 설정을 루트 또는 `backend/supabase` 기준으로 맞추면 됩니다.

API 계약 초안은 `docs/api.md`에 있습니다.

보유자산 관리 MVP 스키마와 주식/ETF seed 데이터는 다음 경로에 있습니다.

- `backend/supabase/migrations/20260613000000_asset_management_mvp.sql`
- `backend/supabase/seed/stocks_seed_400.csv`
- `backend/supabase/functions/get-stock-price/`

현재 가격 조회는 mock provider를 사용합니다. 실제 시장 데이터는 이후 Twelve Data 또는 EODHD API Key를 Supabase Secrets에 등록하고 `priceProvider.ts`만 교체해서 연결합니다.

## Deployment

Vercel은 GitHub `main` 브랜치 push 시 다음 설정으로 `frontend/dist`를 배포하도록 구성되어 있습니다.

- install: `cd frontend && npm install`
- build: `cd frontend && npm run build`
- output: `frontend/dist`
