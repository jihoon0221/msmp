# Money Pilot API 계약서

## 문서 정보

| 항목 | 내용 |
| --- | --- |
| 문서명 | Money Pilot API 계약서 |
| 버전 | v0.3 |
| 상태 | Draft |
| 기준 브랜치 | `feature/portfolio-chart-labels` |
| 기준일 | 2026-06-20 |
| 대상 기능 | 추천 포트폴리오, 보유자산 입력, 보유자산 평가 계산, mock 현재가 조회, USD 환율 평가, 보유자산 기반 뉴스 조회 |

## 1. 결정 사항

이번 단계에서는 **주식/ETF는 mock 가격 조회로 전체 기능을 먼저 완성**한다.

실제 가격 API는 나중에 Twelve Data 또는 EODHD API Key를 Supabase Secrets에 등록한 뒤 `backend/supabase/functions/get-stock-price/priceProvider.ts` 내부 구현만 교체해서 전환한다.

보유자산의 실제 평가액, 수익률, 실제 비중은 FastAPI `POST /api/v1/assets/valuation`이 계산한다. 채권은 사용자가 입력한 매수일과 금리를 기준으로 원금/단리 수익을 계산한다. USD 채권은 저장 시 매수일 USD/KRW 환율을 자동 기록하고, 이후 최신 USD/KRW 환율과 비교해 KRW 평가액과 수익률을 보여준다. 미국 주식/ETF는 원 통화 USD 금액을 먼저 표시하고 괄호 안에 최신 USD/KRW 환산액을 함께 표시한다.

| 항목 | 현재 단계 | 실제 API 전환 단계 |
| --- | --- | --- |
| 가격 조회 위치 | Supabase Edge Function `get-stock-price` | 동일 |
| 가격 Provider | `priceProvider.ts` mock 함수 | Twelve Data 또는 EODHD 호출 |
| API Key 저장 | 필요 없음 | Supabase Secrets |
| 프론트 변경 | 없음 | 없음 |
| DB 저장 위치 | `public.stock_prices` | 동일 |
| 가격 출처 표시 | `source: "mock"` | `source: "twelve_data"` 또는 `source: "eodhd"` |

환율 Provider는 Frankfurter를 사용한다.

| 항목 | 현재 단계 |
| --- | --- |
| 환율 조회 위치 | Supabase Edge Function `get-exchange-rate` |
| 환율 Provider | Frankfurter |
| 지원 통화 | `USD` -> `KRW`, `KRW` -> `KRW` |
| API Key 저장 | 필요 없음 |
| DB 저장 위치 | `public.exchange_rates` |
| 캐시 기준 | historical은 rate date별 영구 캐시, latest는 24시간 TTL |
| 화면 표시 | `Rates by Frankfurter` |

### API Key 필요 시점

| Key | 필요한 시점 | 없으면 어떻게 되는가 |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | 로그인, 자산 저장/조회 테스트를 시작할 때 | 로그인 화면에서 진행할 수 없음 |
| Supabase Edge Function 기본 secrets | `get-stock-price`, `get-exchange-rate` 배포 후 캐시 갱신을 테스트할 때 | 함수가 DB를 읽고 쓸 수 없음 |
| Frankfurter API Key | 필요 없음 | 공개 endpoint라 계속 동작 |
| `TWELVE_DATA_API_KEY` 또는 `EODHD_API_KEY` | mock 가격을 실제 시장 가격으로 바꾸는 시점 | 필요 없음. mock 가격으로 계속 동작 |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | 뉴스 탭에서 실제 네이버 뉴스 조회를 테스트할 때 | 뉴스 탭에 실패 메시지 표시 |
| `AI_API_KEY` | 규칙 기반 추천비중 계산을 실제 AI 추천으로 바꾸는 시점 | 필요 없음. 백엔드 규칙 기반 추천으로 계속 동작 |

## 2. 전체 구조

현재 앱은 API 경계를 두 개로 나눈다.

| 구간 | 역할 | 사용 파일 |
| --- | --- | --- |
| FastAPI | 포트폴리오 추천, 보유자산 평가 계산, 뉴스 조회 | `backend/main.py`, `backend/schemas.py`, `backend/asset_valuation_service.py` |
| Supabase | 보유자산 DB, 주식/ETF 검색, 가격 캐시, 인증/RLS | `backend/supabase/migrations`, `frontend/src/services/assetRepository.ts` |
| Supabase Edge Function | 보유 주식 현재가 조회 및 `stock_prices` 캐시 저장 | `backend/supabase/functions/get-stock-price` |
| Supabase Edge Function | USD/KRW 환율 조회 및 `exchange_rates` 캐시 저장 | `backend/supabase/functions/get-exchange-rate` |

프론트 주요 연결 파일은 다음과 같다.

| 파일 | 역할 |
| --- | --- |
| `frontend/src/services/moneyPilotApi.ts` | FastAPI 호출 |
| `frontend/src/services/assetRepository.ts` | Supabase 자산 CRUD와 가격 갱신 |
| `frontend/src/lib/assetCalculations.ts` | 보유자산 기반 뉴스 키워드 추출 |
| `frontend/src/lib/assetValuation.ts` | 백엔드 평가 결과의 빈 상태 정의 |
| `frontend/src/types/domain.ts` | 프론트 공통 타입 |

## 3. 공통 규칙

### FastAPI Base URL

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
```

FastAPI v1 endpoint는 아래 base path를 사용한다.

```text
/api/v1
```

### Supabase 환경변수

프론트는 Supabase SDK를 사용한다.

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 인증

보유자산 기능은 Supabase Auth 세션이 필요하다.

| 기능 | 인증 |
| --- | --- |
| 추천 포트폴리오 | MVP 기준 선택 |
| 보유자산 조회/저장/삭제 | 필수 |
| 가격 갱신 Edge Function | 필수 |
| 뉴스 조회 | MVP 기준 선택 |

### 변수명 규칙

| 구간 | 규칙 | 예시 |
| --- | --- | --- |
| API JSON | `camelCase` | `targetAmount`, `riskProfile` |
| DB 컬럼 | `snake_case` | `target_amount`, `stock_id` |
| TypeScript 타입 | `PascalCase` | `AssetPortfolio` |

### 금액 단위

FastAPI 요청 금액은 원(KRW) 단위 숫자를 사용한다.

프론트 `FinancialInputs`에서 `Manwon`으로 끝나는 값은 API 요청 전에 `* 10000`으로 변환한다.

| 프론트 필드 | API 필드 | 변환 |
| --- | --- | --- |
| `goalAmountManwon` | `goal.targetAmount` | `* 10000` |
| `currentAssetsManwon` | `financialProfile.currentAssets` | `* 10000` |
| `monthlySalaryManwon` | `financialProfile.monthlySalary` | `* 10000` |
| `monthlySpendManwon` | `financialProfile.monthlySpend` | `* 10000` |

자산 DB의 주식 가격은 종목 통화 기준이다. 예를 들어 미국 종목은 `USD`, 국내 종목은 `KRW`로 저장된다. 현재 단계에서 미국 주식/ETF는 USD 원 금액을 유지하되 화면에 최신 USD/KRW 환산액을 괄호로 함께 표시한다. 직접 입력 USD 채권은 최신 USD/KRW를 실제 KRW 평가액 계산에 사용한다.

## 4. 프론트 공통 타입

```ts
type GoalType = "jeonse" | "seed" | "car" | "wedding" | "other";
type RiskProfile = "stable" | "neutral" | "aggressive";

type FinancialInputs = {
  goalType: GoalType;
  goalAmountManwon: number;
  goalYears: number;
  customGoalLabel?: string;
  currentAssetsManwon: number;
  monthlySalaryManwon: number;
  monthlySpendManwon: number;
  riskProfile: RiskProfile;
};
```

### 보유자산 타입

```ts
type Stock = {
  id: string;
  symbol: string;
  name: string;
  country: "KR" | "US" | string;
  market: string;
  assetType: "stock" | "etf";
  currency: "KRW" | "USD" | string;
  isLargeCap: boolean;
};

type StockAsset = {
  id: string;
  stock: Stock;
  quantity: number;
  averageBuyPrice: number;
  latestPrice: number | null;
  latestFxRate: number | null;
  changeRate: number | null;
  memo: string | null;
};

type DepositAsset = {
  id: string;
  depositType: "deposit" | "installment_savings";
  assetName: string;
  bankName: string | null;
  currency: string;
  currentAmount: number;
  monthlyPayment: number | null;
  interestRate: number | null;
  startDate: string | null;
  maturityDate: string | null;
  memo: string | null;
};

type BondAsset = {
  id: string;
  bondName: string;
  issuer: string | null;
  currency: string;
  principalAmount: number;
  currentValue: number;
  couponRate: number | null;
  purchaseFxRate: number | null;
  latestFxRate: number | null;
  purchaseDate: string | null;
  maturityDate: string | null;
  memo: string | null;
};

type AssetPortfolio = {
  stockAssets: StockAsset[];
  depositAssets: DepositAsset[];
  bondAssets: BondAsset[];
};
```

## 5. FastAPI 계약

## 5.1 추천 포트폴리오 생성

사용자의 목표, 현재 자산, 월 소득/지출, 투자성향을 바탕으로 추천 포트폴리오를 반환한다.

현재 구현은 FastAPI 백엔드가 목표 기간, 월 투자 여력, 목표 달성 최소 월 투자금, 투자성향을 기준으로 최종 추천비중을 계산한다. 프론트는 백엔드가 반환한 추천비중을 재계산하지 않고 표시한다.

### Endpoint

```http
POST /api/v1/portfolio/recommendations
```

### Request Body

```ts
type PortfolioRecommendationRequest = {
  goal: {
    type: GoalType;
    targetAmount: number;
    years: number;
    customLabel?: string;
  };
  financialProfile: {
    currentAssets: number;
    monthlySalary: number;
    monthlySpend: number;
    riskProfile: RiskProfile;
  };
};
```

### Request Example

```json
{
  "goal": {
    "type": "jeonse",
    "targetAmount": 50000000,
    "years": 3
  },
  "financialProfile": {
    "currentAssets": 15000000,
    "monthlySalary": 3200000,
    "monthlySpend": 1800000,
    "riskProfile": "aggressive"
  }
}
```

### Response Body

```ts
type PortfolioRecommendationResponse = {
  recommendationId: string;
  riskProfile: RiskProfile;
  label: string;
  expectedReturnPercent: number;
  volatilityPercent: number;
  rebalanceCycleMonths: number;
  simulation: {
    progressPercent: number;
    cashMonths: number;
    recommendedMonths: number;
    monthSaved: number;
  };
  rationale: {
    summary: string;
    factors: string[];
  };
  allocations: PortfolioAllocation[];
  disclaimer: {
    type: "not_investment_advice";
    message: string;
  };
  generatedAt: string;
};

type PortfolioAllocation = {
  key: "stock-etf" | "deposit-savings" | "bond";
  label: string;
  weight: number;
  color: string;
  candidates: ProductCandidate[];
};

type ProductCandidate = {
  name: string;
  category: string;
  reason: string;
  query: string;
};
```

`allocations`는 백엔드가 최종 추천비중으로 계산해서 반환한다. 현재 MVP의 화면 기준 자산군은 `stock-etf`, `deposit-savings`, `bond` 세 가지이며, 프론트는 이 비중을 다시 보정하지 않는다. 백엔드가 실패한 개발 환경에서만 프론트 로컬 fallback 모델을 사용한다.

### 프론트 사용 위치

| 파일 | 동작 |
| --- | --- |
| `frontend/src/App.tsx` | 분석 버튼 클릭 시 호출 |
| `frontend/src/services/moneyPilotApi.ts` | `requestPortfolioRecommendation()` |

## 5.2 보유자산 평가 계산

프론트가 Supabase에서 읽은 보유자산 원본을 전달하면, FastAPI가 자산군별 평가액, 수익률, 실제 비중을 계산해 반환한다.

### Endpoint

```http
POST /api/v1/assets/valuation
```

### Request Body

```ts
type AssetValuationRequest = {
  stockAssets: StockAsset[];
  depositAssets: DepositAsset[];
  bondAssets: BondAsset[];
};
```

### Response Body

```ts
type AssetValuationResponse = {
  totalValueKrw: number;
  currencySummaries: Array<{
    currency: string;
    totalValue: number;
  }>;
  allocations: Array<{
    key: "stock-etf" | "deposit-savings" | "bond";
    label: string;
    weight: number;
    valueKrw: number;
    color: string;
  }>;
  stockAssets: Array<{
    id: string;
    currency: string;
    purchaseValueNative: number;
    currentValueNative: number | null;
    effectiveValueNative: number;
    purchaseValueKrw: number | null;
    valueKrw: number | null;
    profitLossNative: number | null;
    returnPercent: number | null;
    fxRate: number | null;
  }>;
  depositAssets: Array<{
    id: string;
    currency: string;
    valueNative: number;
    valueKrw: number | null;
    fxRate: number | null;
  }>;
  bondAssets: Array<{
    id: string;
    currency: string;
    principalValueKrw: number;
    currentValueKrw: number;
    profitLossKrw: number;
    returnPercent: number;
    purchaseFxRate: number;
    currentFxRate: number;
    accruedValueNative: number;
  }>;
  generatedAt: string;
};
```

### 자산군별 계산 기준

| 자산군 | 계산 |
| --- | --- |
| 주식/ETF | `quantity * latestPrice`. 현재가가 없으면 실제 비중 계산에는 매입가 기준 금액 사용 |
| 미국 주식/ETF | USD 평가액에 최신 USD/KRW를 곱해 `valueKrw` 계산 |
| 예금/적금 | `currentAmount`를 현재 평가액으로 사용 |
| KRW 채권 | `principalAmount * (1 + couponRate / 100 * 경과일 / 365)` |
| USD 채권 | 위 단리 평가액에 최신 USD/KRW를 곱하고, 매수일 환율 기준 원금과 비교해 수익률 계산 |

### 프론트 사용 위치

| 파일 | 동작 |
| --- | --- |
| `frontend/src/App.tsx` | `AssetPortfolio`가 바뀔 때 호출하고 `AssetValuation`을 중앙 상태로 저장 |
| `frontend/src/features/assets/AssetsView.tsx` | 자산별 평가액/수익률/실제 비중 표시 |
| `frontend/src/features/portfolio/PortfolioDashboard.tsx` | 추천비중과 실제비중 비교 및 리밸런싱 알림 |
| `frontend/src/features/onboarding/OnboardingForm.tsx` | 현재 입력 자산 총액 표시 |

## 5.3 보유자산 기반 뉴스 조회

실제 입력 자산, 추천 포트폴리오 후보, 목표 정보, 투자성향을 바탕으로 관련 기사 목록을 반환한다.

### Endpoint

```http
POST /api/v1/news/related
```

### Request Body

```ts
type RelatedNewsRequest = {
  tickers?: string[];
  assetNames?: string[];
  goalType?: GoalType;
  riskProfile?: RiskProfile;
  limitPerKeyword?: number;
};
```

### Request Fields

| 필드명 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `tickers` | `string[]` | N | 보유 주식/ETF 종목 코드 |
| `assetNames` | `string[]` | N | 보유 자산명과 추천 후보 검색어 |
| `goalType` | `GoalType` | N | 목표 유형 |
| `riskProfile` | `RiskProfile` | N | 투자성향 |
| `limitPerKeyword` | `number` | N | 키워드당 기사 개수. 기본값 `1`, 최대 `5` |

`tickers`, `assetNames`, `goalType`, `riskProfile` 중 최소 하나는 있어야 한다.

### Request Example

```json
{
  "tickers": ["005930.KS", "AAPL"],
  "assetNames": ["삼성전자", "TIGER 미국S&P500"],
  "goalType": "jeonse",
  "riskProfile": "aggressive",
  "limitPerKeyword": 1
}
```

### Response Body

```ts
type RelatedNewsResponse = {
  articles: RelatedNewsArticle[];
};

type RelatedNewsArticle = {
  id: string;
  matchedKeyword: string;
  ticker: string | null;
  source: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string | null;
  fetchedAt: string;
};
```

### 프론트 키워드 생성

| 입력 소스 | API 필드 |
| --- | --- |
| `AssetPortfolio.stockAssets[].stock.symbol` | `tickers` |
| 보유 주식/예금/채권 이름 | `assetNames` |
| 추천 후보 `candidate.query` | `assetNames` |
| 목표 유형 | `goalType` |
| 투자성향 | `riskProfile` |

프론트 구현 위치는 `frontend/src/features/explore/ExploreView.tsx`와 `frontend/src/lib/assetCalculations.ts`이다.

## 6. Supabase DB 계약

## 6.1 `stocks`

주식/ETF 검색용 기준 테이블이다.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | `uuid` | 종목 ID |
| `symbol` | `text` | 종목 코드. unique |
| `name` | `text` | 종목명 |
| `country` | `text` | `KR`, `US` 등 |
| `market` | `text` | 거래소 |
| `asset_type` | `text` | `stock` 또는 `etf` |
| `currency` | `text` | `KRW`, `USD` 등 |
| `is_large_cap` | `boolean` | 대형주 여부 |

프론트 매핑:

| DB 컬럼 | 프론트 필드 |
| --- | --- |
| `asset_type` | `assetType` |
| `is_large_cap` | `isLargeCap` |

검색 구현은 `assetRepository.searchStocks(query, filter)`가 담당한다.

## 6.2 `user_stock_assets`

사용자의 주식/ETF 보유 자산이다.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | `uuid` | 보유 자산 ID |
| `user_id` | `uuid` | Supabase Auth user ID |
| `stock_id` | `uuid` | `stocks.id` |
| `quantity` | `numeric` | 보유 수량 |
| `average_buy_price` | `numeric` | 평균 매수가 |
| `memo` | `text` | 메모 |

저장 구현은 `assetRepository.upsertStockAsset()`가 담당한다. 저장 후 `get-stock-price` Edge Function을 호출해 mock 현재가를 `stock_prices`에 캐시한다.

## 6.3 `stock_prices`

주식/ETF 가격 캐시 테이블이다.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | `uuid` | 가격 row ID |
| `stock_id` | `uuid` | `stocks.id` |
| `price` | `numeric` | 현재가 |
| `currency` | `text` | 가격 통화 |
| `change_rate` | `numeric` | mock 등락률 |
| `fetched_at` | `timestamptz` | 조회 시각 |
| `source` | `text` | `mock`, 추후 `twelve_data`, `eodhd` |

프론트는 해당 종목의 당일 최신 `stock_prices` row를 읽어 `StockAsset.latestPrice`와 `StockAsset.changeRate`로 매핑한다. 미국 주식/ETF는 `get-exchange-rate`로 최신 USD/KRW를 캐시한 뒤 `StockAsset.latestFxRate`로 붙이고, 화면에는 `USD (KRW)` 형태로 표시한다.

## 6.4 `user_deposit_assets`

사용자의 예금/적금 보유 자산이다.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | `uuid` | 자산 ID |
| `user_id` | `uuid` | Supabase Auth user ID |
| `deposit_type` | `text` | `deposit` 또는 `installment_savings` |
| `asset_name` | `text` | 상품명 |
| `bank_name` | `text` | 은행명 |
| `currency` | `text` | 기본 `KRW` |
| `current_amount` | `numeric` | 현재 금액 |
| `monthly_payment` | `numeric` | 월 납입액 |
| `interest_rate` | `numeric` | 연 이자율 |
| `start_date` | `date` | 가입일 |
| `maturity_date` | `date` | 만기일 |
| `memo` | `text` | 메모 |

## 6.5 `user_bond_assets`

사용자의 직접 입력 채권 자산이다.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | `uuid` | 자산 ID |
| `user_id` | `uuid` | Supabase Auth user ID |
| `bond_name` | `text` | 채권명 |
| `issuer` | `text` | 발행기관 |
| `currency` | `text` | `KRW` 또는 `USD` |
| `principal_amount` | `numeric` | 투자 원금. 통화는 `currency` 기준 |
| `current_value` | `numeric` | 호환용 저장 값. 현재 프론트 평가는 `principal_amount`, `coupon_rate`, 환율로 재계산 |
| `coupon_rate` | `numeric` | 표면금리 |
| `purchase_fx_rate` | `numeric` | USD 채권 저장 시 `purchase_date` 기준으로 자동 기록한 USD/KRW 환율 |
| `purchase_date` | `date` | 매수일 |
| `maturity_date` | `date` | 만기일 |
| `memo` | `text` | 메모 |

채권 평가 규칙:

| 구분 | 규칙 |
| --- | --- |
| KRW 채권 | `principal_amount * (1 + coupon_rate / 100 * 경과일 / 365)` |
| USD 채권 | 위 금액을 USD로 계산한 뒤 최신 USD/KRW 환율을 곱해 KRW 평가액으로 표시 |
| 수익률 기준 원금 | KRW 채권은 원금, USD 채권은 `principal_amount * purchase_fx_rate` |
| 이자 계산 | 단리 |
| USD 채권 필수값 | `purchase_date` |

## 6.6 `exchange_rates`

USD 채권 평가용 환율 캐시 테이블이다.

| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| `id` | `uuid` | 환율 row ID |
| `base_currency` | `text` | 현재 `USD` |
| `quote_currency` | `text` | 현재 `KRW` |
| `rate` | `numeric` | `base_currency` 1단위당 `quote_currency` 환율 |
| `rate_date` | `date` | Provider 기준 환율 날짜 |
| `source` | `text` | `frankfurter` |
| `fetched_at` | `timestamptz` | DB 저장 시각 |
| `created_at` | `timestamptz` | row 생성 시각 |

## 7. Supabase Edge Function 계약

## 7.1 주식/ETF 가격 갱신

### Function

```text
get-stock-price
```

프론트 호출 위치:

```ts
supabase.functions.invoke("get-stock-price", {
  body: {
    stock_ids: ["<stock-id>"]
  }
});
```

### Request Body

```ts
type GetStockPriceRequest = {
  stock_id?: string;
  stock_ids?: string[];
};
```

### Response Body

```ts
type GetStockPriceResponse = {
  prices: Array<{
    stock_id: string;
    price: number;
    currency: string;
    change_rate: number | null;
    fetched_at: string;
    source: string | null;
  }>;
};
```

### Mock 가격 규칙

현재 `priceProvider.ts`는 외부 API를 호출하지 않는다.

| symbol | mock price |
| --- | --- |
| `005930.KS` | `73000` |
| `000660.KS` | `220000` |
| `AAPL` | `196` |
| `MSFT` | `480` |
| `SPY` | `590` |
| `QQQ` | `520` |

위 목록에 없는 symbol은 symbol 문자열 hash로 deterministic mock 가격을 만든다. 따라서 seed에 있는 어떤 종목이든 가격 갱신 플로우를 테스트할 수 있다.

## 7.2 USD/KRW 환율 갱신

### Function

```text
get-exchange-rate
```

프론트 호출 위치:

```ts
supabase.functions.invoke("get-exchange-rate", {
  body: {
    base_currency: "USD",
    quote_currency: "KRW",
    rate_date: "2024-01-02"
  }
});
```

### Request Body

```ts
type GetExchangeRateRequest = {
  base_currency?: "USD" | "KRW";
  quote_currency?: "KRW";
  rate_date?: string;
};
```

### Response Body

```ts
type GetExchangeRateResponse = {
  rate: {
    base_currency: string;
    quote_currency: string;
    rate: number;
    rate_date: string;
    source: string | null;
    fetched_at: string;
  };
};
```

### 현재 Provider 규칙

`get-exchange-rate`는 Frankfurter endpoint를 호출한다.

```http
GET https://api.frankfurter.dev/v2/rate/USD/KRW
GET https://api.frankfurter.dev/v2/rate/USD/KRW?date=2024-01-02
```

응답의 `rate`를 `exchange_rates.rate`에 저장한다. `rate_date`가 있는 historical 조회는 해당 날짜 row가 있으면 재사용한다. latest 조회는 24시간 안에 조회했고 `rate_date`가 최근인 캐시만 재사용해, 오늘 저장한 과거 매수일 환율이 현재 환율로 섞이지 않게 한다.

## 8. 실제 가격 API 전환 계약

실제 가격 조회로 전환할 때 프론트, DB, Edge Function endpoint는 유지한다. 변경 지점은 `priceProvider.ts` 하나다.

### Supabase Secrets 후보

Twelve Data를 선택하면:

```bash
supabase secrets set MARKET_PRICE_PROVIDER=twelve_data
supabase secrets set TWELVE_DATA_API_KEY=<key>
```

EODHD를 선택하면:

```bash
supabase secrets set MARKET_PRICE_PROVIDER=eodhd
supabase secrets set EODHD_API_KEY=<key>
```

### 전환 시 지켜야 할 응답 형태

`fetchPrice()`는 실제 Provider를 쓰더라도 항상 아래 형태를 반환해야 한다.

```ts
type PriceProviderResult = {
  price: number;
  currency: string;
  changeRate: number | null;
  source: "mock" | "twelve_data" | "eodhd" | string;
};
```

### 전환 시 수정 범위

| 파일 | 수정 |
| --- | --- |
| `backend/supabase/functions/get-stock-price/priceProvider.ts` | mock 함수 대신 실제 Provider fetch 구현 |
| `backend/supabase/functions/get-stock-price/index.ts` | 보통 수정 없음 |
| `frontend/src/services/assetRepository.ts` | 수정 없음 |
| `frontend/src/features/assets/AssetsView.tsx` | 수정 없음 |

## 9. 화면 동작 흐름

## 9.1 추천 포트폴리오

1. 사용자가 온보딩 폼에 목표/소득/지출/투자성향을 입력한다.
2. `App.tsx`가 `requestPortfolioRecommendation(inputs)`를 호출한다.
3. FastAPI가 목표 기반 추천비중과 설명 근거를 계산해 추천 모델을 반환한다.
4. 프론트는 추천비중을 재계산하지 않고 `PortfolioDashboard`에 표시한다.
5. FastAPI가 꺼진 개발 환경에서는 프론트 로컬 fallback 모델을 사용한다.

## 9.2 보유자산 입력

1. 사용자가 `AssetsView`에서 주식/ETF, 예금/적금, 채권 중 하나를 선택한다.
2. 주식/ETF는 `stocks` 테이블에서 검색한다.
3. 주식/ETF 저장 시 `user_stock_assets`에 upsert한다.
4. 저장 직후 `get-stock-price` Edge Function을 호출한다.
5. Edge Function은 mock 가격을 `stock_prices`에 저장한다.
6. USD 채권 저장/조회 시 `get-exchange-rate` Edge Function을 호출한다.
7. Edge Function은 USD/KRW 환율을 `exchange_rates`에 저장한다.
8. 프론트는 `listAssetPortfolio()`로 보유자산, 최신 가격, 최신 환율을 다시 읽는다.
9. `App.tsx`는 `requestAssetValuation(assetPortfolio)`를 호출해 FastAPI 평가 결과를 받는다.
10. `App.tsx`는 `AssetPortfolio`와 `AssetValuation`을 홈/자산/뉴스 화면에 전달한다.

## 9.3 홈 대시보드 실제 비중

1. `PortfolioDashboard`는 FastAPI가 반환한 `AssetValuation`을 받는다.
2. 백엔드가 계산한 실제 자산 평가액 기준 `주식/ETF`, `예금/적금`, `채권` 비중을 사용한다.
3. 추천비중과 내 자산 기준 비중을 함께 표시한다.
4. 추천비중 대비 실제비중이 ±10%p 이상 벗어나면 프론트가 리밸런싱 알림을 표시한다.

## 9.4 뉴스

1. `ExploreView`는 `AssetPortfolio`와 추천 모델을 받는다.
2. `getAssetPortfolioNewsInputs()`가 보유 종목 코드와 자산명을 만든다.
3. 추천 후보의 `candidate.query`도 함께 검색어로 전달한다.
4. FastAPI `POST /api/v1/news/related`가 네이버 뉴스 API를 호출한다.

## 10. 현재 제한 사항

| 제한 | 설명 |
| --- | --- |
| 가격 | mock 가격이다. 실시간 가격이 아니다. |
| 환율 | KRW/USD만 지원한다. 다른 통화 자산은 KRW 평가액/실제비중에 포함하지 않는다. |
| 추천 | 백엔드 규칙 기반 추천비중 계산이다. 실제 AI API는 아직 연결하지 않았다. |
| 뉴스 | 네이버 뉴스 API Key가 없으면 실패 메시지를 표시한다. |
| 자산 API | 보유자산 CRUD는 FastAPI가 아니라 Supabase SDK를 직접 사용한다. |
| 로그인 | Supabase Auth 세션이 없으면 자산 저장/조회가 실패한다. |

## 11. 다음 구현 순서

1. Supabase migration 적용
2. `stocks_seed_400.csv`를 `public.stocks`에 import
3. `get-stock-price`, `get-exchange-rate` Edge Function 배포
4. 프론트 `.env.local`에 Supabase URL/anon key 입력
5. 로그인 상태에서 자산 추가부터 홈 차트/뉴스까지 end-to-end 확인
6. 실제 가격 API가 필요해지는 시점에 Twelve Data 또는 EODHD를 선택하고 Supabase Secrets 등록
