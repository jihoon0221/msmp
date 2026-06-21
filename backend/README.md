# Backend

백엔드는 FastAPI와 Supabase를 함께 사용합니다. 외부 API 키가 필요한 뉴스/AI 요약은 FastAPI가 감싸고, 인증/DB/가격·환율 캐시는 Supabase가 담당합니다.

## Runtime Boundary

```text
React frontend
  -> FastAPI /api/v1/portfolio/recommendations
  -> FastAPI /api/v1/assets/valuation
  -> FastAPI /api/v1/news/related
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
schemas.py               Request/response DTOs
portfolio_ai_service.py  Goal-aware portfolio recommendation calculation boundary
asset_valuation_service.py Actual asset valuation calculation boundary
news_service.py          Related news provider boundary
supabase/functions/get-stock-price/  Stock price cache + provider boundary
supabase/functions/get-exchange-rate/ USD/KRW exchange-rate cache boundary
```

현재 `portfolio_ai_service.py`는 입력된 목표, 현재 자산, 월 소득/지출, 투자성향을 기준으로 `주식/ETF`, `예금/적금`, `채권` 추천비중을 계산합니다. 실제 AI 연동 전까지 이 파일이 추천비중 계산의 단일 책임 지점입니다.
`asset_valuation_service.py`는 프론트가 Supabase에서 읽은 보유자산을 받아 자산군별 현재 평가액, 수익률, 실제 비중을 계산합니다.
`news_service.py`는 네이버 뉴스 API와 Gemini 요약을 FastAPI 내부에서 호출합니다.
가격 조회의 공식 경로는 FastAPI가 아니라 Supabase Edge Function입니다. 주식/ETF mock 현재가는 `get-stock-price`, USD 채권 평가용 USD/KRW 환율은 `get-exchange-rate`가 담당합니다.

## FastAPI Env

`backend/.env`에만 둡니다. 실제 값은 커밋하지 않습니다.

```env
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
GEMINI_API_KEY=
```

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

`get-stock-price` currently uses mock prices by design. Complete the asset-management flow with mock data first; later replace `priceProvider.ts` with Twelve Data or EODHD and keep API keys in Supabase Secrets.

`get-exchange-rate` uses Frankfurter for USD/KRW, caches one row per currency pair and date in `public.exchange_rates`, and does not require an API key. The frontend uses historical rates to record a USD bond's purchase-date FX rate, then compares it against the latest cached rate.

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
