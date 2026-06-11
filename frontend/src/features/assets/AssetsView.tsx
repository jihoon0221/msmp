import { ChartNoAxesColumn, Plus, Trash2, Wallet, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { getActualAssetValue, getActualTotalValue } from "../../lib/finance";
import { formatPercent, formatWon, formatWonFromManwon } from "../../lib/format";
import type { ActualAsset, FinancialInputs, PortfolioModel } from "../../types/domain";

type AssetsViewProps = {
  inputs: FinancialInputs;
  model: PortfolioModel;
  actualAssets: ActualAsset[];
  openAssetForm: boolean;
  onAssetFormOpened: () => void;
  onAddAsset: (asset: Omit<ActualAsset, "id" | "currentPrice">) => void;
  onRemoveAsset: (id: string) => void;
};

const ASSET_CATEGORIES = [
  "국내 주식형 ETF",
  "해외 주식형 ETF",
  "채권형 ETF",
  "대체자산 ETF",
  "현금성 자산",
] as const;

type AssetCategory = (typeof ASSET_CATEGORIES)[number];

const defaultForm: {
  category: AssetCategory;
  name: string;
  purchasePrice: string;
  quantity: string;
} = {
  category: "해외 주식형 ETF",
  name: "",
  purchasePrice: "",
  quantity: "",
};

const MOCK_ASSET_AUTOCOMPLETE = [
  { name: "TIGER 미국S&P500", category: "해외 주식형 ETF", defaultPrice: 17800 },
  { name: "TIGER 미국테크TOP10 INDXX", category: "해외 주식형 ETF", defaultPrice: 24500 },
  { name: "TIGER 미국30년국채액티브(H)", category: "채권형 ETF", defaultPrice: 9800 },
  { name: "TIGER 미국배당다우존스", category: "해외 주식형 ETF", defaultPrice: 13200 },
  { name: "TIGER 200", category: "국내 주식형 ETF", defaultPrice: 38200 },
  { name: "KODEX 미국나스닥100TR", category: "해외 주식형 ETF", defaultPrice: 15400 },
  { name: "KODEX 200", category: "국내 주식형 ETF", defaultPrice: 36800 },
  { name: "KODEX 단기채권PLUS", category: "채권형 ETF", defaultPrice: 112000 },
  { name: "SOL 미국배당다우존스", category: "해외 주식형 ETF", defaultPrice: 10550 },
  { name: "KOSEF 국고채10년", category: "채권형 ETF", defaultPrice: 112500 },
  { name: "ACE KRX금현물", category: "대체자산 ETF", defaultPrice: 13400 },
  { name: "TIGER 골드선물(H)", category: "대체자산 ETF", defaultPrice: 16800 },
  { name: "ACE 미국S&P500", category: "해외 주식형 ETF", defaultPrice: 19800 },
  { name: "CMA RP형 상품", category: "현금성 자산", defaultPrice: 10000 },
  { name: "고금리 파킹통장", category: "현금성 자산", defaultPrice: 10000 },
  { name: "청년도약계좌", category: "현금성 자산", defaultPrice: 10000 },
] satisfies ReadonlyArray<{ name: string; category: AssetCategory; defaultPrice: number }>;

type AssetSuggestion = (typeof MOCK_ASSET_AUTOCOMPLETE)[number];

const normalizeSearchText = (value: string) => value.toLocaleLowerCase().replace(/\s+/g, "");

export function AssetsView({
  inputs,
  model,
  actualAssets,
  openAssetForm,
  onAssetFormOpened,
  onAddAsset,
  onRemoveAsset,
}: AssetsViewProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [suggestions, setSuggestions] = useState<AssetSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const totalActualValue = getActualTotalValue(actualAssets);
  const totalDisplayValue = totalActualValue > 0 ? totalActualValue : inputs.currentAssetsManwon * 10000;
  const expectedMonthlyProfit = (totalDisplayValue * model.expectedReturnPercent) / 12 / 100;

  useEffect(() => {
    if (!openAssetForm) return;
    setFormOpen(true);
    onAssetFormOpened();
  }, [onAssetFormOpened, openAssetForm]);

  useEffect(() => {
    const query = normalizeSearchText(form.name.trim());

    if (!query) {
      setSuggestions([]);
      return;
    }

    setSuggestions(
      MOCK_ASSET_AUTOCOMPLETE.filter((item) => normalizeSearchText(item.name).includes(query))
    );
  }, [form.name]);

  const selectSuggestion = (suggestion: AssetSuggestion) => {
    setForm((current) => ({
      ...current,
      category: suggestion.category,
      name: suggestion.name,
      purchasePrice: String(suggestion.defaultPrice),
    }));
    setShowSuggestions(false);
  };

  const submitAsset = () => {
    const purchasePrice = Number(form.purchasePrice);
    const quantity = Number(form.quantity);
    if (!form.category.trim() || !form.name.trim() || purchasePrice <= 0 || quantity <= 0) return;

    onAddAsset({
      category: form.category.trim(),
      name: form.name.trim(),
      purchasePrice,
      quantity,
    });
    setForm(defaultForm);
    setFormOpen(false);
  };

  return (
    <main className="no-scrollbar flex-1 overflow-y-auto bg-slate-50 px-5 py-5 pb-24">
      <h2 className="mb-1 text-xl font-black">자산 관리</h2>
      <p className="mb-4 text-[10px] text-slate-400">보유 중인 자산을 직접 입력하면 홈 탭 차트가 실제 자산 기준으로 바뀝니다.</p>

      <section className="relative mb-5 overflow-hidden rounded-2xl bg-blue-600 p-5 text-white shadow-md">
        <Wallet className="absolute -right-3 -top-3 text-white opacity-10" size={76} />
        <p className="mb-1 text-[10px] text-blue-100">총 입력 자산</p>
        <h3 className="mb-3 text-2xl font-black">
          {formatWon(totalDisplayValue)} <span className="text-sm font-normal">기준</span>
        </h3>
        <div className="flex items-center justify-between rounded-xl bg-blue-700/50 p-2.5 text-xs">
          <div>
            <p className="text-[9px] text-blue-200">이번 달 예상 수익</p>
            <p className="font-bold text-green-300">+ {formatWon(expectedMonthlyProfit)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-blue-200">기대 연수익률</p>
            <p className="font-bold text-green-300">{formatPercent(model.expectedReturnPercent)}</p>
          </div>
        </div>
      </section>

      <Card className="mb-5">
        <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold text-slate-900">
          <ChartNoAxesColumn size={15} className="text-blue-600" />
          추천 배분 기준 구성 비중
        </h3>
        <div className="space-y-3.5">
          {model.allocations.map((allocation) => {
            const allocationAmount = (totalDisplayValue / 10000) * (allocation.weight / 100);
            return (
              <div key={allocation.key}>
                <div className="mb-1 flex justify-between gap-3 text-xs">
                  <span className="font-bold text-slate-600">{allocation.label}</span>
                  <span className="shrink-0 font-extrabold text-slate-900">
                    {formatWonFromManwon(allocationAmount)} ({allocation.weight}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100">
                  <div className="h-2 rounded-full" style={{ width: `${allocation.weight}%`, backgroundColor: allocation.color }} />
                </div>
              </div>
            );
          })}
        </div>

        <Button className="mt-4 w-full" variant="secondary" onClick={() => setFormOpen(true)}>
          <Plus size={15} />
          실제 자산 입력하기
        </Button>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Wallet size={15} className="text-emerald-500" />
            수동 기입 보유 목록
          </h3>
          <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-extrabold text-slate-500">
            일일 시세 기준
          </span>
        </div>
        <p className="mb-3 text-[9px] font-medium leading-relaxed text-slate-400">
          현재가는 하루 1회 갱신되는 마감가 기준입니다.
        </p>
        {actualAssets.length > 0 ? (
          <div className="space-y-2.5">
            {actualAssets.map((asset) => {
              const purchaseValue = asset.purchasePrice * asset.quantity;
              const currentValue = getActualAssetValue(asset);
              const profitLoss = currentValue - purchaseValue;
              const returnPercent =
                asset.purchasePrice > 0
                  ? ((asset.currentPrice - asset.purchasePrice) / asset.purchasePrice) * 100
                  : 0;
              const performanceClass =
                profitLoss > 0
                  ? "bg-rose-50 text-rose-600"
                  : profitLoss < 0
                    ? "bg-blue-50 text-blue-600"
                    : "bg-slate-100 text-slate-500";

              return (
                <div key={asset.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="inline-flex rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-500">
                        {asset.category}
                      </span>
                      <p className="mt-2 truncate text-sm font-extrabold text-slate-800">{asset.name}</p>
                    </div>
                    <button
                      type="button"
                      aria-label={`${asset.name} 삭제`}
                      className="shrink-0 rounded-lg p-2 text-slate-300 hover:bg-white hover:text-rose-500"
                      onClick={() => onRemoveAsset(asset.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-500">
                    <p>
                      매입단가: <span className="font-bold text-slate-700">{formatWon(asset.purchasePrice)}</span>
                    </p>
                    <p>
                      보유수량: <span className="font-bold text-slate-700">{asset.quantity}주</span>
                    </p>
                    <p className="col-span-2">
                      현재단가: <span className="font-extrabold text-blue-600">{formatWon(asset.currentPrice)}</span>
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <p className="text-xs font-black text-slate-800">평가액 {formatWon(currentValue)}</p>
                    <span className={`rounded-lg px-2 py-1 text-[10px] font-extrabold ${performanceClass}`}>
                      수익률: {formatPercent(returnPercent)} ({profitLoss > 0 ? "+" : ""}
                      {formatWon(profitLoss)})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl bg-slate-50 p-3 text-center text-xs font-semibold text-slate-400">
            아직 입력된 실제 자산이 없습니다.
          </p>
        )}
      </Card>

      {formOpen ? (
        <div className="absolute inset-0 z-50 flex items-end bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setFormOpen(false)}>
          <div className="w-full rounded-2xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">실제 자산 입력</h3>
              <button
                type="button"
                aria-label="자산 입력 닫기"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                onClick={() => setFormOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-slate-500">카테고리</span>
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, category: event.target.value as AssetCategory }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ASSET_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="relative block">
                <span className="mb-1 block text-[11px] font-semibold text-slate-500">종목 이름</span>
                <input
                  value={form.name}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, name: event.target.value }));
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setShowSuggestions(false)}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={showSuggestions && suggestions.length > 0}
                  aria-controls="asset-name-suggestions"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="예: TIGER 미국S&P500"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <ul
                    id="asset-name-suggestions"
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
                  >
                    {suggestions.map((suggestion) => (
                      <li key={suggestion.name} role="option">
                        <button
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            selectSuggestion(suggestion);
                          }}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                        >
                          <span className="truncate text-xs font-extrabold text-slate-700">{suggestion.name}</span>
                          <span className="shrink-0 rounded-md bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-600">
                            {suggestion.category}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="mb-1 block text-[11px] font-semibold text-slate-500">구매가격 (원)</span>
                  <input
                    type="number"
                    min={0}
                    value={form.purchasePrice}
                    onChange={(event) => setForm((current) => ({ ...current, purchasePrice: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="15000"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-[11px] font-semibold text-slate-500">구매량</span>
                  <input
                    type="number"
                    min={0}
                    value={form.quantity}
                    onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="10"
                  />
                </label>
              </div>
              <Button className="w-full" variant="secondary" onClick={submitAsset}>
                입력 완료
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
