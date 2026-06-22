# Backend

백엔드는 FastAPI와 Supabase를 함께 사용합니다. 외부 API 키가 필요한 뉴스/AI 요약은 FastAPI가 감싸고, 인증/DB/가격·환율 캐시는 Supabase가 담당합니다.

## Runtime Boundary

```text
React frontend
  -> FastAPI /api/v1/portfolio/recommendations
  -> FastAPI /api/v1/assets/valuation
  -> FastAPI /api/v1/news/related
  -> Supabase access token in Authorization header
  -> Supabase Auth / DB / Edge Functions

FastAPI
  -> Naver News API
  -> Gemini API

Supabase Edge Functions
  -> get-stock-price: stock price cache/provider boundary
  -> get-exchange-rate: USD/KRW exchange-rate cache boundary
```

프론트에는 `VITE_*` public env만 둡니다. `NAVER_CLIENT_SECRET`, `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 같은 secret은 브라우저로 내려가면 안 됩니다.

## FastAPI Structure

```text
main.py                  API route definitions
auth.py                  Supabase access-token verification for FastAPI routes
schemas.py               Request/response DTOs
portfolio_ai_service.py  Goal-aware portfolio recommendation calculation boundary
asset_valuation_service.py Actual asset valuation calculation boundary
news_service.py          Related news provider boundary
supabase/functions/get-stock-price/  Stock price cache + provider boundary
supabase/functions/get-exchange-rate/ USD/KRW exchange-rate cache boundary
```

현재 `portfolio_ai_service.py`는 입력된 목표, 현재 자산, 월 소득/지출, 투자성향을 기준으로 `주식/ETF`, `예금/적금`, `채권` 추천비중을 계산하는 규칙 기반 엔진이며, 추천비중 계산의 단일 책임 지점입니다.
`asset_valuation_service.py`는 프론트가 Supabase에서 읽은 보유자산을 받아 자산군별 현재 평가액, 수익률, 실제 비중을 계산합니다.
`news_service.py`는 네이버 뉴스 API와 Gemini 요약을 FastAPI 내부에서 호출합니다. 같은 뉴스 요청은 FastAPI 프로세스 안에서 2시간 동안 캐시해서 탭 진입이나 새로고침 버튼 때문에 Naver/Gemini를 반복 호출하지 않게 합니다.
가격 조회의 공식 경로는 FastAPI가 아니라 Supabase Edge Function입니다. 국내 `.KS` 종목은 `get-stock-price`가 Naver Finance를 우선 조회하고, 해외·미지원 종목은 mock fallback을 사용합니다. USD 채권 평가용 USD/KRW 환율은 `get-exchange-rate`가 담당합니다.

## FastAPI Env

`backend/.env`에만 둡니다. 실제 값은 커밋하지 않습니다.

```env
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
GEMINI_API_KEY=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_JWT_SECRET=
API_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

`SUPABASE_URL`은 Supabase project URL, `SUPABASE_PUBLISHABLE_KEY`는 프론트의 `VITE_SUPABASE_ANON_KEY`와 같은 publishable/anon key입니다.
`SUPABASE_JWT_SECRET`은 HS256 legacy JWT를 직접 검증할 때만 사용합니다. ES256/RS256 access token은 Supabase Auth 서버로 검증합니다.
`API_ALLOWED_ORIGINS`에는 로컬 프론트 주소와 배포된 프론트 주소를 쉼표로 넣습니다.

`POST /api/v1/portfolio/recommendations`, `POST /api/v1/assets/valuation`, `POST /api/v1/news/related`는 Supabase 로그인 세션의 access token이 필요합니다.
프론트는 `Authorization: Bearer <access_token>` 헤더를 자동으로 붙입니다.

설정 여부는 키 값을 노출하지 않는 헬스체크로 확인합니다.

```bash
curl http://127.0.0.1:8001/api/v1/health
```

예상 응답:

```json
{
  "status": "ok",
  "services": {
    "portfolioRecommendation": true,
    "assetValuation": true,
    "authGuard": true,
    "naverNews": true,
    "geminiDigest": true
  }
}
```

## Asset Management MVP

The asset-management MVP uses separated tables for stock/ETF, deposit/installment savings, and direct bonds.

```text
backend/supabase/migrations/20260613000000_asset_management_mvp.sql
backend/supabase/migrations/20260620001000_exchange_rates_and_bond_fx.sql
backend/supabase/seed/stocks_seed_400.csv
backend/supabase/functions/get-stock-price/
backend/supabase/functions/get-exchange-rate/
```

`stocks_seed_400.csv` is imported into `public.stocks`; re-imports should upsert by `symbol`.

`get-stock-price` fetches Naver Finance prices for domestic `.KS` symbols and falls back to deterministic mock prices on provider failure. Non-domestic symbols currently use mock prices. The frontend calls the function only when a held stock has no price cache or the cached price is older than 24 hours. Replace the non-domestic branch in `priceProvider.ts` with Twelve Data or EODHD and keep API keys in Supabase Secrets when real overseas prices are required.

`get-exchange-rate` uses Frankfurter for USD/KRW, caches one row per currency pair and date in `public.exchange_rates`, and does not require an API key. The frontend uses historical rates to record a USD bond's purchase-date FX rate, then compares it against the latest cached rate. Latest USD/KRW is refreshed only when the cached row is older than 24 hours.

## Migration

초기 마이그레이션:

```text
backend/supabase/migrations/20260602000000_initial_schema.sql
```

로컬 Supabase CLI 또는 원격 프로젝트에 적용할 때 이 파일을 Supabase migration 디렉터리로 지정하거나 복사해서 사용합니다.

```bash
supabase link --project-ref <project-ref>
supabase db push
```

운영 전에는 금융 규제 문구, 상품 공시, 투자자 적합성 설문 저장 구조를 실제 준법 검토 기준으로 보강해야 합니다.
