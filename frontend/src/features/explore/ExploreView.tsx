import {
  FileText,
  RotateCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/ui/Card";
import { getAssetPortfolioNewsInputs } from "../../lib/assetCalculations";
import { requestRelatedNews } from "../../services/moneyPilotApi";
import type {
  AssetPortfolio,
  FinancialInputs,
  PortfolioModel,
  RelatedNewsArticle,
  RelatedNewsDigestSummary,
} from "../../types/domain";

type ExploreViewProps = {
  inputs: FinancialInputs;
  model: PortfolioModel;
  assetPortfolio: AssetPortfolio;
  assetPortfolioLoaded: boolean;
};

const riskLabels: Record<FinancialInputs["riskProfile"], string> = {
  aggressive: "공격형",
  neutral: "중립형",
  stable: "안정형",
};

const NEWS_ERROR_MESSAGE = "뉴스를 불러오지 못했습니다. 백엔드 서버 또는 API 키를 확인해주세요.";
const NEWS_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const NEWS_CACHE_PREFIX = "moneyPilotRelatedNews:v2";

type CachedNewsPayload = {
  articles: RelatedNewsArticle[];
  digestSummary: RelatedNewsDigestSummary[];
};

export function ExploreView({ inputs, model, assetPortfolio, assetPortfolioLoaded }: ExploreViewProps) {
  const [articles, setArticles] = useState<RelatedNewsArticle[]>([]);
  const [digestSummary, setDigestSummary] = useState<RelatedNewsDigestSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const newsInputs = useMemo(() => getAssetPortfolioNewsInputs(assetPortfolio), [assetPortfolio]);
  const { assetNames, tickers } = newsInputs;
  const candidateQueries = useMemo(
    () => model.allocations.flatMap((allocation) => allocation.candidates.map((candidate) => candidate.query)),
    [model],
  );
  const cacheKey = useMemo(
    () =>
      buildNewsCacheKey({
        assetNames,
        candidateQueries,
        goalType: inputs.goalType,
        riskProfile: inputs.riskProfile,
        tickers,
      }),
    [assetNames, candidateQueries, inputs.goalType, inputs.riskProfile, tickers],
  );

  useEffect(() => {
    let ignore = false;

    async function fetchRelatedNews() {
      if (!assetPortfolioLoaded) {
        setIsLoading(true);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const cachedNews = refreshCount === 0 ? readCachedNews(cacheKey) : null;
        if (cachedNews) {
          setArticles(cachedNews.articles);
          setDigestSummary(cachedNews.digestSummary);
          setIsLoading(false);
          return;
        }

        const newsResponse = await requestRelatedNews({
          assetNames,
          tickers,
          candidateQueries,
          goalType: inputs.goalType,
          riskProfile: inputs.riskProfile,
        });
        if (ignore) return;
        setArticles(newsResponse.articles);
        setDigestSummary(newsResponse.digestSummary ?? []);
        writeCachedNews(cacheKey, {
          articles: newsResponse.articles,
          digestSummary: newsResponse.digestSummary ?? [],
        });
      } catch {
        if (ignore) return;
        setArticles([]);
        setDigestSummary([]);
        setError(NEWS_ERROR_MESSAGE);
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void fetchRelatedNews();
    return () => {
      ignore = true;
    };
  }, [assetNames, assetPortfolioLoaded, cacheKey, candidateQueries, inputs.goalType, inputs.riskProfile, refreshCount, tickers]);

  return (
    <main className="no-scrollbar flex-1 overflow-y-auto bg-slate-950 px-5 py-5 pb-24">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-100">보유 자산 관련 뉴스</h2>
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => setRefreshCount((value) => value + 1)}
          disabled={isLoading}
        >
          다른 기사
          <RotateCw size={11} className={isLoading ? "animate-spin" : undefined} />
        </button>
      </div>
      <div className="mb-4">
        <p className="mb-1 text-[10px] text-slate-400">
          현재 나의 보유 종목과 {riskLabels[inputs.riskProfile]} 투자 성향을 기반으로 선별한 관련 뉴스입니다.
        </p>
        <p className="text-[9px] font-semibold text-blue-300">네이버 뉴스 검색 API에서 최신 관련 기사를 가져옵니다.</p>
      </div>

      <div className="mb-4 rounded-2xl bg-slate-900 p-4 text-white shadow-lg">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-xs font-extrabold">보유 종목 AI 요약</h3>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[8px] font-bold text-blue-100">Gemini</span>
        </div>
        {isLoading ? (
          <p className="rounded-xl bg-white/10 px-3 py-2 text-[10px] leading-relaxed text-slate-300">
            요약을 불러오는 중입니다.
          </p>
        ) : digestSummary.length > 0 ? (
          <ul className="space-y-2">
            {digestSummary.map((item) => (
              <li key={item.ticker} className="rounded-xl bg-white/10 px-3 py-2">
                <strong className="block text-[11px] text-white">{item.ticker}</strong>
                <span className="text-[10px] leading-relaxed text-slate-300">{item.summary}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-white/10 px-3 py-2 text-[10px] leading-relaxed text-slate-300">
            요약할 보유 종목 뉴스가 없습니다.
          </p>
        )}
      </div>

      <Card>
        <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold text-slate-100">보유 종목 기반 관련 기사</h3>
        {isLoading ? (
          <p className="py-6 text-center text-xs text-slate-400">관련 뉴스를 불러오는 중입니다.</p>
        ) : error ? (
          <p className="py-6 text-center text-xs text-rose-300">{error}</p>
        ) : articles.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">표시할 관련 뉴스가 없습니다.</p>
        ) : (
          <ul className="space-y-3.5">
            {articles.map((article) => (
              <li key={article.id}>
                <ArticleRow article={article} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}

function buildNewsCacheKey(params: {
  assetNames: string[];
  candidateQueries: string[];
  goalType: FinancialInputs["goalType"];
  riskProfile: FinancialInputs["riskProfile"];
  tickers: string[];
}) {
  return `${NEWS_CACHE_PREFIX}:${JSON.stringify({
    assetNames: normalizeCacheValues(params.assetNames),
    candidateQueries: normalizeCacheValues(params.candidateQueries),
    goalType: params.goalType,
    riskProfile: params.riskProfile,
    tickers: normalizeCacheValues(params.tickers),
  })}`;
}

function normalizeCacheValues(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean).sort();
}

function readCachedNews(cacheKey: string): CachedNewsPayload | null {
  try {
    const rawValue = localStorage.getItem(cacheKey);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as CachedNewsPayload & { cachedAt?: number };
    if (!parsed.cachedAt || Date.now() - parsed.cachedAt > NEWS_CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return {
      articles: Array.isArray(parsed.articles) ? parsed.articles : [],
      digestSummary: Array.isArray(parsed.digestSummary) ? parsed.digestSummary : [],
    };
  } catch {
    localStorage.removeItem(cacheKey);
    return null;
  }
}

function writeCachedNews(cacheKey: string, payload: CachedNewsPayload) {
  try {
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        ...payload,
        cachedAt: Date.now(),
      }),
    );
  } catch {
    // Ignore cache write failures; news still renders from the live response.
  }
}

function ArticleRow({ article }: { article: RelatedNewsArticle }) {
  return (
    <a className="flex gap-3 rounded-xl border border-slate-700 bg-slate-900 p-2.5 transition hover:bg-slate-800" href={article.url} target="_blank" rel="noreferrer">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-blue-300">
        <FileText size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <span className="text-[8px] font-extrabold text-slate-400">
          {article.matchedKeyword} · {article.source}
          </span>
          <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[8px] font-bold text-blue-300">원문</span>
        </div>
        <p className="line-clamp-2 text-xs font-bold text-slate-100">{article.title}</p>
        <p className="mt-1 line-clamp-2 text-[9px] text-slate-400">{article.summary}</p>
      </div>
    </a>
  );
}
