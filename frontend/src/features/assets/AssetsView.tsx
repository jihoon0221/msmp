import { CalendarDays, ChartNoAxesColumn, Pencil, Plus, Search, Trash2, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import {
  calculateBondAssetMetrics,
  calculateStockAssetMetrics,
  emptyAssetPortfolio,
  summarizeAssetPortfolioByCurrency,
} from "../../lib/assetCalculations";
import { formatPercent, formatWon } from "../../lib/format";
import {
  createBondAsset,
  createDepositAsset,
  deleteAsset,
  listAssetPortfolio,
  searchStocks,
  updateBondAsset,
  updateDepositAsset,
  updateStockAsset,
  upsertStockAsset,
  type BondAssetInput,
  type DepositAssetInput,
  type StockAssetInput,
} from "../../services/assetRepository";
import type { AssetPortfolio, BondAsset, DepositAsset, FinancialInputs, PortfolioModel, Stock, StockAsset } from "../../types/domain";

type AssetsViewProps = {
  inputs: FinancialInputs;
  model: PortfolioModel;
  openAssetForm: boolean;
  onAssetFormOpened: () => void;
  onAssetPortfolioChange: (portfolio: AssetPortfolio) => void;
};

type AssetType = "stock" | "deposit" | "bond";
type EditingAsset = {
  type: AssetType;
  id: string;
};
type AllocationSummary = {
  key: string;
  label: string;
  weight: number;
  color: string;
};
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

const assetTypeLabels: Record<AssetType, string> = {
  stock: "주식/ETF",
  deposit: "예금/적금",
  bond: "채권",
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
  const [editingAsset, setEditingAsset] = useState<EditingAsset | null>(null);

  const summaries = useMemo(() => summarizeAssetPortfolioByCurrency(portfolio), [portfolio]);
  const assetAllocations = useMemo(() => buildEnteredAssetAllocations(portfolio, model.allocations), [model.allocations, portfolio]);
  const fallbackValue = inputs.currentAssetsManwon * 10000;

  useEffect(() => {
    if (!openAssetForm) return;
    resetForms();
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
    setEditingAsset(null);
  };

  const openFormForAssetType = (type: AssetType) => {
    resetForms();
    setAssetType(type);
    setError(null);
    setFormOpen(true);
  };

  const openStockEditor = (asset: StockAsset) => {
    resetForms();
    setAssetType("stock");
    setEditingAsset({ type: "stock", id: asset.id });
    setSelectedStock(asset.stock);
    setStockQuery(asset.stock.name);
    setStockForm({
      quantity: String(asset.quantity),
      averageBuyPrice: String(asset.averageBuyPrice),
      memo: asset.memo ?? "",
    });
    setError(null);
    setFormOpen(true);
  };

  const openDepositEditor = (asset: DepositAsset) => {
    resetForms();
    setAssetType("deposit");
    setEditingAsset({ type: "deposit", id: asset.id });
    setDepositForm({
      depositType: asset.depositType,
      assetName: asset.assetName,
      bankName: asset.bankName ?? "",
      currentAmount: String(asset.currentAmount),
      monthlyPayment: asset.monthlyPayment == null ? "" : String(asset.monthlyPayment),
      interestRate: asset.interestRate == null ? "" : String(asset.interestRate),
      startDate: asset.startDate ?? "",
      maturityDate: asset.maturityDate ?? "",
      memo: asset.memo ?? "",
    });
    setError(null);
    setFormOpen(true);
  };

  const openBondEditor = (asset: BondAsset) => {
    resetForms();
    setAssetType("bond");
    setEditingAsset({ type: "bond", id: asset.id });
    setBondForm({
      bondName: asset.bondName,
      issuer: asset.issuer ?? "",
      principalAmount: String(asset.principalAmount),
      currentValue: String(asset.currentValue),
      couponRate: asset.couponRate == null ? "" : String(asset.couponRate),
      purchaseDate: asset.purchaseDate ?? "",
      maturityDate: asset.maturityDate ?? "",
      memo: asset.memo ?? "",
    });
    setError(null);
    setFormOpen(true);
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
      if (editingAsset?.type === "stock") {
        await updateStockAsset(editingAsset.id, input);
      } else {
        await upsertStockAsset(input);
      }
      resetForms();
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
      if (editingAsset?.type === "deposit") {
        await updateDepositAsset(editingAsset.id, input);
      } else {
        await createDepositAsset(input);
      }
      resetForms();
    });
  };

  const submitBondAsset = async () => {
    const input: BondAssetInput = {
      bondName: bondForm.bondName,
      issuer: bondForm.issuer,
      principalAmount: Number(bondForm.principalAmount),
      currentValue: Number(bondForm.principalAmount),
      couponRate: bondForm.couponRate ? Number(bondForm.couponRate) : undefined,
      purchaseDate: bondForm.purchaseDate,
      maturityDate: bondForm.maturityDate,
      memo: bondForm.memo,
    };

    if (!input.bondName.trim() || input.principalAmount < 0) {
      setError("채권명과 투자 원금을 확인해주세요.");
      return;
    }

    await submitAsset(async () => {
      if (editingAsset?.type === "bond") {
        await updateBondAsset(editingAsset.id, input);
      } else {
        await createBondAsset(input);
      }
      resetForms();
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

  const resetForms = () => {
    setSelectedStock(null);
    setStockQuery("");
    setStockResults([]);
    setStockForm(initialStockForm);
    setDepositForm(initialDepositForm);
    setBondForm(initialBondForm);
    setEditingAsset(null);
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
            <h3 className="text-2xl font-black">{formatWon(fallbackValue)}</h3>
          )}
        </div>
      </section>

      <Card className="mb-5 bg-slate-900 border-slate-700">
        <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold text-slate-100">
          <ChartNoAxesColumn size={15} className="text-blue-400" />
          추천 배분 구성 비중
        </h3>
        <AllocationStack title="추천 비중" allocations={model.allocations} />
        <AllocationStack title="내 자산 기준 비중" allocations={assetAllocations} emptyMessage="입력된 자산이 없습니다." />

      </Card>

      {error ? <p className="mb-4 rounded-xl border border-rose-800 bg-rose-950 p-3 text-xs font-semibold text-rose-300">{error}</p> : null}
      {loading ? <p className="mb-4 text-center text-xs text-slate-400">보유자산을 불러오는 중입니다.</p> : null}

      <AssetSections
        portfolio={portfolio}
        onAdd={openFormForAssetType}
        onEditStock={openStockEditor}
        onEditDeposit={openDepositEditor}
        onEditBond={openBondEditor}
        onRemove={removeAsset}
      />

      {formOpen ? (
        <div className="absolute inset-0 z-50 flex items-end bg-slate-900/70 p-4 backdrop-blur-sm" onClick={closeForm}>
          <div className="max-h-[86vh] w-full overflow-y-auto rounded-2xl bg-slate-950 p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-100">
                {assetTypeLabels[assetType]} {editingAsset ? "수정" : "추가"}
              </h3>
              <button
                type="button"
                aria-label="자산 입력 닫기"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                onClick={closeForm}
              >
                <X size={18} />
              </button>
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
                <MoneyInput
                  label="평균 매수가"
                  value={stockForm.averageBuyPrice}
                  onChange={(value) => setStockForm((current) => ({ ...current, averageBuyPrice: value }))}
                />
                <TextInput label="메모" value={stockForm.memo} onChange={(value) => setStockForm((current) => ({ ...current, memo: value }))} />
                <Button className="w-full" variant="secondary" onClick={submitStockAsset} disabled={submitting}>
                  {submitting ? "저장 중..." : editingAsset ? "주식/ETF 수정" : "주식/ETF 저장"}
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
                <MoneyInput label="원금" value={depositForm.currentAmount} onChange={(value) => setDepositForm((current) => ({ ...current, currentAmount: value }))} />
                {depositForm.depositType === "installment_savings" ? (
                  <MoneyInput
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
                  {submitting ? "저장 중..." : editingAsset ? "예금/적금 수정" : "예금/적금 저장"}
                </Button>
              </div>
            ) : null}

            {assetType === "bond" ? (
              <div className="space-y-3">
                <TextInput label="채권명" value={bondForm.bondName} onChange={(value) => setBondForm((current) => ({ ...current, bondName: value }))} />
                <MoneyInput label="투자 원금" value={bondForm.principalAmount} onChange={(value) => setBondForm((current) => ({ ...current, principalAmount: value }))} />
                <TextInput label="발행기관" value={bondForm.issuer} onChange={(value) => setBondForm((current) => ({ ...current, issuer: value }))} />
                <NumberInput label="표면금리" value={bondForm.couponRate} onChange={(value) => setBondForm((current) => ({ ...current, couponRate: value }))} />
                <DateInput label="매수일" value={bondForm.purchaseDate} onChange={(value) => setBondForm((current) => ({ ...current, purchaseDate: value }))} />
                <DateInput label="만기일" value={bondForm.maturityDate} onChange={(value) => setBondForm((current) => ({ ...current, maturityDate: value }))} />
                <TextInput label="메모" value={bondForm.memo} onChange={(value) => setBondForm((current) => ({ ...current, memo: value }))} />
                <Button className="w-full" variant="secondary" onClick={submitBondAsset} disabled={submitting}>
                  {submitting ? "저장 중..." : editingAsset ? "채권 수정" : "채권 저장"}
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
  onAdd,
  onEditStock,
  onEditDeposit,
  onEditBond,
  onRemove,
}: {
  portfolio: AssetPortfolio;
  onAdd: (type: AssetType) => void;
  onEditStock: (asset: StockAsset) => void;
  onEditDeposit: (asset: DepositAsset) => void;
  onEditBond: (asset: BondAsset) => void;
  onRemove: (type: AssetType, id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle title="주식/ETF" count={portfolio.stockAssets.length} onAdd={() => onAdd("stock")} />
        <div className="space-y-2.5">
          {portfolio.stockAssets.map((asset) => {
            const metrics = calculateStockAssetMetrics(asset);
            return (
              <AssetRow
                key={asset.id}
                title={asset.stock.name}
                subtitle={`${asset.stock.symbol} · ${asset.stock.market} · ${asset.stock.currency}`}
                value={metrics.currentValue == null ? "가격 조회 필요" : formatWon(metrics.currentValue)}
                detail={`수량 ${asset.quantity} · 평균 ${formatWon(asset.averageBuyPrice)} · 현재 ${
                  asset.latestPrice == null ? "조회 필요" : formatWon(asset.latestPrice)
                }`}
                tone={metrics.profitLoss == null ? "neutral" : metrics.profitLoss >= 0 ? "gain" : "loss"}
                badge={metrics.returnPercent == null ? undefined : formatPercent(metrics.returnPercent)}
                onEdit={() => onEditStock(asset)}
                onRemove={() => onRemove("stock", asset.id)}
              />
            );
          })}
          {portfolio.stockAssets.length === 0 ? <EmptyState label="입력된 주식/ETF가 없습니다." /> : null}
        </div>
      </Card>

      <Card>
        <SectionTitle title="예금/적금" count={portfolio.depositAssets.length} onAdd={() => onAdd("deposit")} />
        <div className="space-y-2.5">
          {portfolio.depositAssets.map((asset) => (
            <AssetRow
              key={asset.id}
              title={asset.assetName}
              subtitle={`${asset.depositType === "deposit" ? "예금" : "적금"} · ${asset.bankName ?? "은행 미입력"}`}
              value={formatWon(asset.currentAmount)}
              detail={asset.interestRate == null ? "이자율 미입력" : `연 ${asset.interestRate}%`}
              onEdit={() => onEditDeposit(asset)}
              onRemove={() => onRemove("deposit", asset.id)}
            />
          ))}
          {portfolio.depositAssets.length === 0 ? <EmptyState label="입력된 예금/적금이 없습니다." /> : null}
        </div>
      </Card>

      <Card>
        <SectionTitle title="채권" count={portfolio.bondAssets.length} onAdd={() => onAdd("bond")} />
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
                onEdit={() => onEditBond(asset)}
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

function SectionTitle({ title, count, onAdd }: { title: string; count: number; onAdd: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-xs font-black text-slate-100">{title}</h3>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-slate-800 px-2 py-1 text-[9px] font-extrabold text-slate-300">{count}개</span>
        <button
          type="button"
          aria-label={`${title} 추가`}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-500"
          onClick={onAdd}
        >
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}

function AllocationStack({
  title,
  allocations,
  emptyMessage,
}: {
  title: string;
  allocations: AllocationSummary[];
  emptyMessage?: string;
}) {
  const hasAllocations = allocations.some((allocation) => allocation.weight > 0);

  return (
    <div className="mb-5 last:mb-0">
      <p className="mb-2 text-[10px] font-extrabold text-slate-400">{title}</p>
      {hasAllocations ? (
        <>
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-800">
            {allocations.map((allocation) => (
              <div
                key={allocation.key}
                className="h-full"
                style={{ width: `${allocation.weight}%`, backgroundColor: allocation.color }}
                title={`${allocation.label} ${allocation.weight}%`}
              />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
            {allocations.map((allocation) => (
              <div key={allocation.key} className="flex min-w-0 items-center gap-2 text-[11px] font-bold text-slate-200">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: allocation.color }} />
                <span className="min-w-0 flex-1 leading-snug">{allocation.label}</span>
                <span className="shrink-0 text-slate-100">{allocation.weight}%</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="rounded-xl bg-slate-800 p-3 text-center text-xs font-semibold text-slate-400">{emptyMessage}</p>
      )}
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
  onEdit,
  onRemove,
}: {
  title: string;
  subtitle: string;
  value: string;
  detail: string;
  badge?: string;
  tone?: "neutral" | "gain" | "loss";
  onEdit: () => void;
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
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`${title} 수정`}
            className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-blue-300"
            onClick={onEdit}
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            aria-label={`${title} 삭제`}
            className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-rose-400"
            onClick={onRemove}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-black text-slate-100">{value}</p>
        <span className="text-[10px] font-semibold text-slate-400">{detail}</span>
        {badge ? <span className={`rounded-lg px-2 py-1 text-[10px] font-extrabold ${toneClass}`}>{badge}</span> : null}
      </div>
    </div>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <BaseInput label={label} type="text" value={value} onChange={onChange} />;
}

function NumberInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <BaseInput label={label} type="number" value={value} onChange={onChange} />;
}

function MoneyInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <BaseInput
      label={label}
      type="text"
      inputMode="numeric"
      value={formatNumericInput(value)}
      onChange={(nextValue) => onChange(stripNumericSeparators(nextValue))}
    />
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const pickerRef = useRef<HTMLInputElement | null>(null);
  const pickerValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";

  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker) return;

    if (typeof picker.showPicker === "function") {
      picker.showPicker();
      return;
    }

    picker.click();
  };

  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-400">{label}</span>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          placeholder="yyyy-mm-dd"
          value={value}
          onChange={(event) => onChange(formatDateInput(event.target.value))}
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 pr-11 text-xs font-semibold text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          aria-label={`${label} 달력 열기`}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-blue-300"
          onClick={openPicker}
        >
          <CalendarDays size={16} />
        </button>
        <input
          ref={pickerRef}
          type="date"
          value={pickerValue}
          onChange={(event) => onChange(event.target.value)}
          className="sr-only"
          tabIndex={-1}
        />
      </div>
    </label>
  );
}

function BaseInput({
  label,
  type,
  inputMode,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  type: "text" | "number" | "date";
  inputMode?: "numeric" | "decimal";
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-400">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        min={type === "number" ? 0 : undefined}
        placeholder={placeholder}
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

function stripNumericSeparators(value: string) {
  return value.replace(/[^\d]/g, "");
}

function formatNumericInput(value: string) {
  const digits = stripNumericSeparators(value);
  return digits ? Number(digits).toLocaleString("ko-KR") : "";
}

function formatDateInput(value: string) {
  const digits = value.replace(/[^\d]/g, "").slice(0, 8);
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);

  return [year, month, day].filter(Boolean).join("-");
}

function buildEnteredAssetAllocations(portfolio: AssetPortfolio, modelAllocations: AllocationSummary[]): AllocationSummary[] {
  const stockValue = portfolio.stockAssets.reduce((total, asset) => {
    const metrics = calculateStockAssetMetrics(asset);
    return total + (metrics.currentValue ?? metrics.purchaseValue);
  }, 0);
  const depositValue = portfolio.depositAssets.reduce((total, asset) => total + asset.currentAmount, 0);
  const bondValue = portfolio.bondAssets.reduce((total, asset) => total + asset.currentValue, 0);
  const totalValue = stockValue + depositValue + bondValue;
  const valueByKey: Record<string, number> = {
    "stock-etf": stockValue,
    "deposit-savings": depositValue,
    bond: bondValue,
  };

  return modelAllocations.map((allocation) => ({
    key: allocation.key,
    label: allocation.label,
    color: allocation.color,
    weight: totalValue > 0 ? Math.round(((valueByKey[allocation.key] ?? 0) / totalValue) * 100) : 0,
  }));
}
