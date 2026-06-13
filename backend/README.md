# Backend

초기 백엔드는 Supabase를 사용합니다.

## Responsibilities

- Auth: Supabase Auth
- DB: PostgreSQL
- API: Supabase auto-generated REST/RPC API
- Security: RLS policy
- Schema: SQL migration

## FastAPI Structure

```text
main.py                  API route definitions
schemas.py               Request/response DTOs
portfolio_ai_service.py  AI portfolio recommendation provider boundary
news_service.py          Related news provider boundary
supabase/functions/get-stock-price/  Stock price cache + provider boundary
```

현재 `portfolio_ai_service.py`는 실제 외부 API 연결 전 구조용 스텁 응답을 반환합니다.
`news_service.py`는 네이버 뉴스 API 키가 있을 때 실제 호출합니다.
가격 조회의 공식 경로는 FastAPI가 아니라 Supabase Edge Function `get-stock-price`입니다.

## Asset Management MVP

The asset-management MVP uses separated tables for stock/ETF, deposit/installment savings, and direct bonds.

```text
backend/supabase/migrations/20260613000000_asset_management_mvp.sql
backend/supabase/seed/stocks_seed_400.csv
backend/supabase/functions/get-stock-price/
```

`stocks_seed_400.csv` is imported into `public.stocks`; re-imports should upsert by `symbol`.

`get-stock-price` currently uses mock prices by design. Complete the asset-management flow with mock data first; later replace `priceProvider.ts` with Twelve Data or EODHD and keep API keys in Supabase Secrets.

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
