# Backend

이 프로젝트는 별도 Node 백엔드 서버 대신 Supabase를 백엔드로 사용합니다.

- DB 스키마와 RLS 정책: `backend/supabase/migrations`
- Edge Functions 자리: `backend/supabase/functions`
- 프론트엔드 연결: `frontend/src/lib/supabase.ts`

로컬 Supabase CLI를 쓰는 경우:

```sh
supabase start
supabase db reset
```
