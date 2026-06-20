import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { AuthView } from "./features/auth/AuthView";
import { AssetsView } from "./features/assets/AssetsView";
import { ExploreView } from "./features/explore/ExploreView";
import { OnboardingForm } from "./features/onboarding/OnboardingForm";
import { PortfolioDashboard } from "./features/portfolio/PortfolioDashboard";
import { ProfileView } from "./features/profile/ProfileView";
import { emptyAssetPortfolio } from "./lib/assetCalculations";
import { getPortfolioModel, defaultFinancialInputs } from "./lib/finance";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { requestPortfolioRecommendation } from "./services/moneyPilotApi";
import type { AppTab, AssetPortfolio, FinancialInputs, PortfolioModel } from "./types/domain";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [inputs, setInputs] = useState<FinancialInputs>(defaultFinancialInputs);
  const [assetPortfolio, setAssetPortfolio] = useState<AssetPortfolio>(emptyAssetPortfolio);
  const [openAssetForm, setOpenAssetForm] = useState(false);
  const [portfolioDesigned, setPortfolioDesigned] = useState(false);
  const [excludedCandidates, setExcludedCandidates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const fallbackModel = useMemo(() => getPortfolioModel(inputs), [inputs]);
  const [recommendedModel, setRecommendedModel] = useState<PortfolioModel | null>(null);
  const model = recommendedModel ?? fallbackModel;

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setSession(data.session);
      })
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setAssetPortfolio(emptyAssetPortfolio);
        setActiveTab("home");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const analyze = async () => {
    setExcludedCandidates([]);
    setLoading(true);
    setRecommendationError(null);

    try {
      const nextModel = await requestPortfolioRecommendation(inputs);
      setRecommendedModel(nextModel);
    } catch (error) {
      console.warn("Portfolio recommendation API unavailable. Falling back to local template.", error);
      setRecommendedModel(null);
    } finally {
      setPortfolioDesigned(true);
      setActiveTab("home");
      setLoading(false);
    }
  };

  const resetGoal = () => {
    setExcludedCandidates([]);
    setPortfolioDesigned(false);
    setRecommendedModel(null);
    setRecommendationError(null);
    setActiveTab("home");
  };

  const toggleCandidate = (candidateName: string) => {
    setExcludedCandidates((current) =>
      current.includes(candidateName)
        ? current.filter((name) => name !== candidateName)
        : [...current, candidateName],
    );
  };

  const openAssetInputFromHome = () => {
    setActiveTab("assets");
    setOpenAssetForm(true);
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const renderContent = () => {
    if (loading) return <LoadingView />;

    if (activeTab === "home") {
      if (!portfolioDesigned) {
        return <OnboardingForm inputs={inputs} error={recommendationError} onChange={setInputs} onAnalyze={analyze} />;
      }
      return (
        <PortfolioDashboard
          inputs={inputs}
          model={model}
          assetPortfolio={assetPortfolio}
          excludedCandidates={excludedCandidates}
          onToggleCandidate={toggleCandidate}
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
          openAssetForm={openAssetForm}
          onAssetFormOpened={() => setOpenAssetForm(false)}
          onAssetPortfolioChange={setAssetPortfolio}
        />
      );
    }

    if (activeTab === "explore") {
      return <ExploreView inputs={inputs} model={model} assetPortfolio={assetPortfolio} />;
    }

    return (
      <ProfileView
        model={model}
        userEmail={session?.user.email}
        onResetGoal={resetGoal}
        onSignOut={signOut}
      />
    );
  };

  if (authLoading) return <AuthLoadingView />;
  if (!session) return <AuthView onAuthenticated={setSession} />;

  return (
    <AppShell activeTab={activeTab} userEmail={session.user.email} onTabChange={setActiveTab}>
      {renderContent()}
    </AppShell>
  );
}

function AuthLoadingView() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
        <p className="text-xs font-bold text-slate-500">로그인 상태를 확인하는 중입니다.</p>
      </div>
    </main>
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
