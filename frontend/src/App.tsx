import { useMemo, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { getPortfolioModel, defaultFinancialInputs } from "./lib/finance";
import { AssetsView } from "./features/assets/AssetsView";
import { ExploreView } from "./features/explore/ExploreView";
import { OnboardingForm } from "./features/onboarding/OnboardingForm";
import { PortfolioDashboard } from "./features/portfolio/PortfolioDashboard";
import { ProfileView } from "./features/profile/ProfileView";
import type { ActualAsset, AppTab, FinancialInputs } from "./types/domain";

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [inputs, setInputs] = useState<FinancialInputs>(defaultFinancialInputs);
  const [actualAssets, setActualAssets] = useState<ActualAsset[]>([]);
  const [openAssetForm, setOpenAssetForm] = useState(false);
  const [portfolioDesigned, setPortfolioDesigned] = useState(false);
  const [loading, setLoading] = useState(false);
  const model = useMemo(() => getPortfolioModel(inputs), [inputs]);

  const analyze = () => {
    setLoading(true);
    window.setTimeout(() => {
      setPortfolioDesigned(true);
      setLoading(false);
      setActiveTab("home");
    }, 900);
  };

  const resetGoal = () => {
    setPortfolioDesigned(false);
    setActiveTab("home");
  };

  const openAssetInputFromHome = () => {
    setActiveTab("assets");
    setOpenAssetForm(true);
  };

  const addActualAsset = (asset: Omit<ActualAsset, "id" | "currentPrice">) => {
    setActualAssets((current) => [
      ...current,
      {
        ...asset,
        id: crypto.randomUUID(),
        currentPrice: asset.purchasePrice,
      },
    ]);
  };

  const removeActualAsset = (id: string) => {
    setActualAssets((current) => current.filter((asset) => asset.id !== id));
  };

  const renderContent = () => {
    if (loading) return <LoadingView />;

    if (activeTab === "home") {
      if (!portfolioDesigned) {
        return <OnboardingForm inputs={inputs} onChange={setInputs} onAnalyze={analyze} />;
      }
      return (
        <PortfolioDashboard
          inputs={inputs}
          model={model}
          actualAssets={actualAssets}
          onOpenAssetInput={openAssetInputFromHome}
          onReset={resetGoal}
        />
      );
    }

    if (activeTab === "assets") {
      return (
        <AssetsView
          inputs={inputs}
          model={model}
          actualAssets={actualAssets}
          openAssetForm={openAssetForm}
          onAssetFormOpened={() => setOpenAssetForm(false)}
          onAddAsset={addActualAsset}
          onRemoveAsset={removeActualAsset}
        />
      );
    }

    if (activeTab === "explore") {
      return <ExploreView riskProfile={inputs.riskProfile} />;
    }

    return <ProfileView model={model} onResetGoal={resetGoal} />;
  };

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </AppShell>
  );
}

function LoadingView() {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white">
      <div className="mb-4 h-14 w-14 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
      <h2 className="mb-1 text-lg font-extrabold text-slate-900">정량적 포트폴리오 최적화 중...</h2>
      <div className="space-y-1 px-8 text-center text-xs text-slate-500">
        <p>소득 대비 목표 달성 가능성을 계산 중...</p>
        <p className="text-[11px] font-bold text-blue-600">MPT 기반 자산 배분 후보 탐색 중...</p>
      </div>
    </div>
  );
}

export default App;
