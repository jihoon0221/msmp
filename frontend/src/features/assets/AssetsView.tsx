import { ChartNoAxesColumn, Plus, Search, Trash2, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import {
  calculateBondAssetMetrics,
  calculateStockAssetMetrics,
  emptyAssetPortfolio,
  summarizeAssetPortfolioByCurrency,
} from "../../lib/assetCalculations";
import { formatPercent, formatWon, formatWonFromManwon } from "../../lib/format";
import {
  createBondAsset,
  createDepositAsset,
  deleteAsset,
  listAssetPortfolio,
  searchStocks,
  upsertStockAsset,
  type BondAssetInput,
  type DepositAssetInput,
  type StockAssetInput,
} from "../../services/assetRepository";
import type { AssetPortfolio, FinancialInputs, PortfolioModel, Stock } from "../../types/domain";

type AssetsViewProps = {
  inputs: FinancialInputs;
  model: PortfolioModel;
  openAssetForm: boolean;
  onAssetFormOpened: () => void;
  onAssetPortfolioChange: (portfolio: AssetPortfolio) => void;
};

type AssetType = "stock" | "deposit" | "bond";
type DepositFormState = {
  depositType: "deposit" | "installment_savings";
  assetName: string;
  bankName: string;
  currentAmount: string;
  monthlyPayment: string;
  interestRate: string;
  startDate: string;
  maturityDate: string;
  memo: string;
};

const initialStockForm = {
  quantity: "",
  averageBuyPrice: "",
  memo: "",
};

const initialDepositForm: DepositFormState = {
  depositType: "deposit" as const,
  assetName: "",
  bankName: "",
  currentAmount: "",
  monthlyPayment: "",
  interestRate: "",
  startDate: "",
  maturityDate: "",
  memo: "",
};

const initialBondForm = {
  bondName: "",
  issuer: "",
  principalAmount: "",
  currentValue: "",
  couponRate: "",
  purchaseDate: "",
  maturityDate: "",
  memo: "",
};

export function AssetsView({
  inputs,
  model,
  openAssetForm,
  onAssetFormOpened,
  onAssetPortfolioChange,
}: AssetsViewProps) {
  const [portfolio, setPortfolio] = useState<AssetPortfolio>(emptyAssetPortfolio);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [assetType, setAssetType] = useState<AssetType>("stock");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stockQuery, setStockQuery] = useState("");
  const [stockResults, setStockResults] = useState<Stock[]>([]);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [stockForm, setStockForm] = useState(initialStockForm);
  const [depositForm, setDepositForm] = useState(initialDepositForm);
  const [bondForm, setBondForm] = useState(initialBondForm);

  const summaries = useMemo(() => summarizeAssetPortfolioByCurrency(portfolio), [portfolio]);
  const fallbackValue = inputs.currentAssetsManwon * 10000;
  const displayTotalValue = summaries.find((summary) => summary.currency === "KRW")?.totalValue ?? fallbackValue;

  useEffect(() => {
    if (!openAssetForm) return;
    setFormOpen(true);
    onAssetFormOpened();
  }, [onAssetFormOpened, openAssetForm]);

  useEffect(() => {
    void refreshPortfolio();
  }, []);

  useEffect(() => {
    onAssetPortfolioChange(portfolio);
  }, [onAssetPortfolioChange, portfolio]);

  useEffect(() => {
    let ignore = false;

    async function runSearch() {
      try {
        const results = await searchStocks(stockQuery, "all");
        if (!ignore) setStockResults(results);
      } catch {
        if (!ignore) setStockResults([]);
      }
    }

    void runSearch();
    return () => {
      ignore = true;
    };
  }, [stockQuery]);

  const refreshPortfolio = async () => {
    setLoading(true);
    setError(null);

    try {
      setPortfolio(await listAssetPortfolio());
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "보유자산을 불러오지 못했습니다.");
      setPortfolio(emptyAssetPortfolio);
    } finally {
      setLoading(false);
    }
  };

  const closeForm = () => {
    setFormOpen(false);
    setError(null);
  };

  const submitStockAsset = async () => {
    if (!selectedStock) {
      setError("종목을 먼저 선택해주세요.");
      return;
    }

    const input: StockAssetInput = {
      stockId: selectedStock.id,
      quantity: Number(stockForm.quantity),
      averageBuyPrice: Number(stockForm.averageBuyPrice),
      memo: stockForm.memo,
    };

    if (input.quantity <= 0 || input.averageBuyPrice < 0) {
      setError("보유 수량과 평균 매수가를 확인해주세요.");
      return;
    }

    await submitAsset(async () => {
      await upsertStockAsset(input);
      setSelectedStock(null);
      setStockForm(initialStockForm);
    });
  };

  const submitDepositAsset = async () => {
    const input: DepositAssetInput = {
      depositType: depositForm.depositType,
      assetName: depositForm.assetName,
      bankName: depositForm.bankName,
      currentAmount: Number(depositForm.currentAmount),
      monthlyPayment: depositForm.monthlyPayment ? Number(depositForm.monthlyPayment) : undefined,
      interestRate: depositForm.interestRate ? Number(depositForm.interestRate) : undefined,
      startDate: depositForm.startDate,
      maturityDate: depositForm.maturityDate,
      memo: depositForm.memo,
    };

    if (!input.assetName.trim() || input.currentAmount < 0) {
      setError("상품명과 현재 금액을 확인해주세요.");
      return;
    }

    await submitAsset(async () => {
      await createDepositAsset(input);
      setDepositForm(initialDepositForm);
    });
  };

  const submitBondAsset = async () => {
    const input: BondAssetInput = {
      bondName: bondForm.bondName,
      issuer: bondForm.issuer,
      principalAmount: Number(bondForm.principalAmount),
      currentValue: Number(bondForm.currentValue),
      couponRate: bondForm.couponRate ? Number(bondForm.couponRate) : undefined,
      purchaseDate: bondForm.purchaseDate,
      maturityDate: bondForm.maturityDate,
      memo: bondForm.memo,
    };

    if (!input.bondName.trim() || input.principalAmount < 0 || input.currentValue < 0) {
      setError("채권명, 투자 원금, 현재 평가액을 확인해주세요.");
      return;
    }

    await submitAsset(async () => {
      await createBondAsset(input);
      setBondForm(initialBondForm);
    });
  };

  const submitAsset = async (save: () => Promise<void>) => {
    setSubmitting(true);
    setError(null);

    try {
      await save();
      await refreshPortfolio();
      closeForm();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "자산 저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const removeAsset = async (type: AssetType, id: string) => {
    setError(null);
    try {
      await deleteAsset(type, id);
      await refreshPortfolio();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "자산 삭제에 실패했습니다.");
    }
  };

  return (
    <main className="no-scrollbar flex-1 overflow-y-auto bg-slate-950 px-5 py-5 pb-24">
      <h2 className="mb-1 text-xl font-black text-slate-100">자산 관리</h2>
      <p className="mb-4 text-[10px] text-slate-400">주식/ETF, 예금/적금, 채권을 분리해서 입력하고 평가금액을 확인합니다.</p>

      <section className="relative mb-5 overflow-hidden rounded-2xl bg-blue-600 p-5 text-white shadow-md">
        <Wallet className="absolute -right-3 -top-3 text-white opacity-10" size={76} />
        <p className="mb-1 text-[10px] text-blue-100">총 입력 자산</p>
        <div className="mb-3 space-y-1">
          {summaries.length > 0 ? (
            summaries.map((summary) => (
              <h3 key={summary.currency} className="text-2xl font-black">
                {summary.currency} {formatWon(summary.totalValue)}
              </h3>
            ))
          ) : (
            <h3 className="text-2xl font-black">{formatWon(fallbackValue)} 기준</h3>
          )}
        </div>
      </section>

      <Card className="mb-5 bg-slate-900 border-slate-700">
        <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold text-slate-100">
          <ChartNoAxesColumn size={15} className="text-blue-400" />
          추천 배분 기준 구성 비중
        </h3>
        <div className="space-y-3.5">
          {model.allocations.map((allocation) => {
            const allocationAmount = (displayTotalValue / 10000) * (allocation.weight / 100);
            return (
              <div key={allocation.key}>
                <div className="mb-1 flex justify-between gap-3 text-xs">
                  <span className="font-bold text-slate-200">{allocation.label}</span>
                  <span className="shrink-0 font-extrabold text-slate-100">
                    {formatWonFromManwon(allocationAmount)} ({allocation.weight}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800">
                  <div className="h-2 rounded-full" style={{ width: `${allocation.weight}%`, backgroundColor: allocation.color }} />
                </div>
              </div>
            );
          })}
        </div>

        <Button className="mt-4 w-full" variant="secondary" onClick={() => setFormOpen(true)}>
          <Plus size={15} />
          보유자산 추가
        </Button>
      </Card>

      {error ? <p className="mb-4 rounded-xl border border-rose-800 bg-rose-950 p-3 text-xs font-semibold text-rose-300">{error}</p> : null}
      {loading ? <p className="mb-4 text-center text-xs text-slate-400">보유자산을 불러오는 중입니다.</p> : null}

      <AssetSections portfolio={portfolio} onRemove={removeAsset} />

      {formOpen ? (
        <div className="absolute inset-0 z-50 flex items-end bg-slate-900/70 p-4 backdrop-blur-sm" onClick={closeForm}>
          <div className="max-h-[86vh] w-full overflow-y-auto rounded-2xl bg-slate-950 p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-100">보유자산 추가</h3>
              <button
                type="button"
                aria-label="자산 입력 닫기"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                onClick={closeForm}
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2">
              <AssetTypeButton selected={assetType === "stock"} label="주식/ETF" onClick={() => setAssetType("stock")} />
              <AssetTypeButton selected={assetType === "deposit"} label="예금/적금" onClick={() => setAssetType("deposit")} />
              <AssetTypeButton selected={assetType === "bond"} label="채권" onClick={() => setAssetType("bond")} />
            </div>

            {assetType === "stock" ? (
              <div className="space-y-3">
                <label>
                  <span className="mb-1 block text-[11px] font-semibold text-slate-400">종목 검색</span>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5">
                    <Search size={14} className="text-slate-500" />
                    <input
                      value={stockQuery}
                      onChange={(event) => setStockQuery(event.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-slate-100 outline-none placeholder:text-slate-500"
                      placeholder="삼성전자, AAPL"
                    />
                  </div>
                </label>

                {stockQuery.trim() ? (
                  <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-2">
                    {stockResults.map((stock) => (
                      <button
                        key={stock.id}
                        type="button"
                        className={`w-full rounded-lg px-3 py-2 text-left text-[11px] ${
                          selectedStock?.id === stock.id ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-200"
                        }`}
                        onClick={() => setSelectedStock(stock)}
                      >
                        <strong>{stock.name}</strong>
                        <span className="ml-2 opacity-80 text-slate-400">
                          {stock.symbol} · {stock.country} · {stock.assetType.toUpperCase()}
                        </span>
                      </button>
                    ))}
                    {stockResults.length === 0 ? <p className="py-4 text-center text-xs text-slate-400">검색 결과가 없습니다.</p> : null}
                  </div>
                ) : null}

                {selectedStock ? (
                  <div className="rounded-xl border border-blue-800 bg-slate-900 p-3 text-xs">
                    <p className="font-extrabold text-slate-100">{selectedStock.name}</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-blue-300">
                      {selectedStock.symbol} · {selectedStock.market} · {selectedStock.currency}
                    </p>
                  </div>
                ) : null}

                <NumberInput label="보유 수량" value={stockForm.quantity} onChange={(value) => setStockForm((current) => ({ ...current, quantity: value }))} />
                <NumberInput
                  label="평균 매수가"
                  value={stockForm.averageBuyPrice}
                  onChange={(value) => setStockForm((current) => ({ ...current, averageBuyPrice: value }))}
                />
                <TextInput label="메모" value={stockForm.memo} onChange={(value) => setStockForm((current) => ({ ...current, memo: value }))} />
                <Button className="w-full" variant="secondary" onClick={submitStockAsset} disabled={submitting}>
                  {submitting ? "저장 중..." : "주식/ETF 저장"}
                </Button>
              </div>
            ) : null}

            {assetType === "deposit" ? (
              <div className="space-y-3">
                <label>
                  <span className="mb-1 block text-[11px] font-semibold text-slate-400">구분</span>
                  <select
                    value={depositForm.depositType}
                    onChange={(event) =>
                      setDepositForm((current) => ({
                        ...current,
                        depositType: event.target.value as "deposit" | "installment_savings",
                      }))
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs font-semibold text-slate-100"
                  >
                    <option value="deposit">예금</option>
                    <option value="installment_savings">적금</option>
                  </select>
                </label>
                <TextInput label="상품명" value={depositForm.assetName} onChange={(value) => setDepositForm((current) => ({ ...current, assetName: value }))} />
                <NumberInput label="현재 금액" value={depositForm.currentAmount} onChange={(value) => setDepositForm((current) => ({ ...current, currentAmount: value }))} />
                {depositForm.depositType === "installment_savings" ? (
                  <NumberInput
                    label="월 납입액"
                    value={depositForm.monthlyPayment}
                    onChange={(value) => setDepositForm((current) => ({ ...current, monthlyPayment: value }))}
                  />
                ) : null}
                <TextInput label="은행명" value={depositForm.bankName} onChange={(value) => setDepositForm((current) => ({ ...current, bankName: value }))} />
                <NumberInput label="연 이자율" value={depositForm.interestRate} onChange={(value) => setDepositForm((current) => ({ ...current, interestRate: value }))} />
                <DateInput label="가입일" value={depositForm.startDate} onChange={(value) => setDepositForm((current) => ({ ...current, startDate: value }))} />
                <DateInput label="만기일" value={depositForm.maturityDate} onChange={(value) => setDepositForm((current) => ({ ...current, maturityDate: value }))} />
                <TextInput label="메모" value={depositForm.memo} onChange={(value) => setDepositForm((current) => ({ ...current, memo: value }))} />
                <Button className="w-full" variant="secondary" onClick={submitDepositAsset} disabled={submitting}>
                  {submitting ? "저장 중..." : "예금/적금 저장"}
                </Button>
              </div>
            ) : null}

            {assetType === "bond" ? (
              <div className="space-y-3">
                <TextInput label="채권명" value={bondForm.bondName} onChange={(value) => setBondForm((current) => ({ ...current, bondName: value }))} />
                <NumberInput label="투자 원금" value={bondForm.principalAmount} onChange={(value) => setBondForm((current) => ({ ...current, principalAmount: value }))} />
                <NumberInput label="현재 평가액" value={bondForm.currentValue} onChange={(value) => setBondForm((current) => ({ ...current, currentValue: value }))} />
                <TextInput label="발행기관" value={bondForm.issuer} onChange={(value) => setBondForm((current) => ({ ...current, issuer: value }))} />
                <NumberInput label="표면금리" value={bondForm.couponRate} onChange={(value) => setBondForm((current) => ({ ...current, couponRate: value }))} />
                <DateInput label="매수일" value={bondForm.purchaseDate} onChange={(value) => setBondForm((current) => ({ ...current, purchaseDate: value }))} />
                <DateInput label="만기일" value={bondForm.maturityDate} onChange={(value) => setBondForm((current) => ({ ...current, maturityDate: value }))} />
                <TextInput label="메모" value={bondForm.memo} onChange={(value) => setBondForm((current) => ({ ...current, memo: value }))} />
                <Button className="w-full" variant="secondary" onClick={submitBondAsset} disabled={submitting}>
                  {submitting ? "저장 중..." : "채권 저장"}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function AssetSections({
  portfolio,
  onRemove,
}: {
  portfolio: AssetPortfolio;
  onRemove: (type: AssetType, id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle title="주식/ETF" count={portfolio.stockAssets.length} />
        <div className="space-y-2.5">
          {portfolio.stockAssets.map((asset) => {
            const metrics = calculateStockAssetMetrics(asset);
            return (
              <AssetRow
                key={asset.id}
                title={asset.stock.name}
                subtitle={`${asset.stock.symbol} · ${asset.stock.market} · ${asset.stock.currency}`}
                value={metrics.currentValue == null ? "가격 조회 필요" : formatWon(metrics.currentValue)}
                detail={`수량 ${asset.quantity} · 평균 ${formatWon(asset.averageBuyPrice)}`}
                tone={metrics.profitLoss == null ? "neutral" : metrics.profitLoss >= 0 ? "gain" : "loss"}
                badge={metrics.returnPercent == null ? undefined : formatPercent(metrics.returnPercent)}
                onRemove={() => onRemove("stock", asset.id)}
              />
            );
          })}
          {portfolio.stockAssets.length === 0 ? <EmptyState label="입력된 주식/ETF가 없습니다." /> : null}
        </div>
      </Card>

      <Card>
        <SectionTitle title="예금/적금" count={portfolio.depositAssets.length} />
        <div className="space-y-2.5">
          {portfolio.depositAssets.map((asset) => (
            <AssetRow
              key={asset.id}
              title={asset.assetName}
              subtitle={`${asset.depositType === "deposit" ? "예금" : "적금"} · ${asset.bankName ?? "은행 미입력"}`}
              value={formatWon(asset.currentAmount)}
              detail={asset.interestRate == null ? "이자율 미입력" : `연 ${asset.interestRate}%`}
              onRemove={() => onRemove("deposit", asset.id)}
            />
          ))}
          {portfolio.depositAssets.length === 0 ? <EmptyState label="입력된 예금/적금이 없습니다." /> : null}
        </div>
      </Card>

      <Card>
        <SectionTitle title="채권" count={portfolio.bondAssets.length} />
        <div className="space-y-2.5">
          {portfolio.bondAssets.map((asset) => {
            const metrics = calculateBondAssetMetrics(asset);
            return (
              <AssetRow
                key={asset.id}
                title={asset.bondName}
                subtitle={asset.issuer ?? "발행기관 미입력"}
                value={formatWon(asset.currentValue)}
                detail={`원금 ${formatWon(asset.principalAmount)}`}
                tone={metrics.profitLoss >= 0 ? "gain" : "loss"}
                badge={formatPercent(metrics.returnPercent)}
                onRemove={() => onRemove("bond", asset.id)}
              />
            );
          })}
          {portfolio.bondAssets.length === 0 ? <EmptyState label="입력된 채권이 없습니다." /> : null}
        </div>
      </Card>
    </div>
  );
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-xs font-black text-slate-100">{title}</h3>
      <span className="rounded-full bg-slate-800 px-2 py-1 text-[9px] font-extrabold text-slate-300">{count}개</span>
    </div>
  );
}

function AssetRow({
  title,
  subtitle,
  value,
  detail,
  badge,
  tone = "neutral",
  onRemove,
}: {
  title: string;
  subtitle: string;
  value: string;
  detail: string;
  badge?: string;
  tone?: "neutral" | "gain" | "loss";
  onRemove: () => void;
}) {
  const toneClass =
    tone === "gain" ? "bg-rose-950 text-rose-300" : tone === "loss" ? "bg-blue-950 text-blue-300" : "bg-slate-800 text-slate-300";

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-slate-100">{title}</p>
          <p className="mt-0.5 text-[10px] font-semibold text-slate-400">{subtitle}</p>
        </div>
        <button
          type="button"
          aria-label={`${title} 삭제`}
          className="shrink-0 rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-rose-400"
          onClick={onRemove}
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-black text-slate-100">{value}</p>
        <span className="text-[10px] font-semibold text-slate-400">{detail}</span>
        {badge ? <span className={`rounded-lg px-2 py-1 text-[10px] font-extrabold ${toneClass}`}>{badge}</span> : null}
      </div>
    </div>
  );
}

function AssetTypeButton({ selected, label, onClick }: { selected: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`rounded-xl border px-2 py-2 text-xs font-extrabold ${
        selected ? "border-blue-500 bg-slate-800 text-slate-100" : "border-slate-700 text-slate-400 hover:bg-slate-800"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <BaseInput label={label} type="text" value={value} onChange={onChange} />;
}

function NumberInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <BaseInput label={label} type="number" value={value} onChange={onChange} />;
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <BaseInput label={label} type="date" value={value} onChange={onChange} />;
}

function BaseInput({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: "text" | "number" | "date";
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-400">{label}</span>
      <input
        type={type}
        min={type === "number" ? 0 : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs font-semibold text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="rounded-xl bg-slate-800 p-3 text-center text-xs font-semibold text-slate-400">{label}</p>;
}
