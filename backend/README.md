# Backend

초기 백엔드는 Supabase를 사용합니다.

## Responsibilities

- Auth: Supabase Auth
- DB: PostgreSQL
- API: Supabase auto-generated REST/RPC API
- Security: RLS policy
- Schema: SQL migration

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

