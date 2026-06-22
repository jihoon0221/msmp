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
  RelatedNewsDigestBriefing,
  RelatedNewsDigestStatus,
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
const NEWS_SHORT_CACHE_TTL_MS = 10 * 60 * 1000;
const NEWS_RETRY_CACHE_GRACE_MS = 5 * 1000;
const NEWS_CACHE_PREFIX = "moneyPilotRelatedNews:v16";
const NEWS_CANDIDATES_PER_CATEGORY = 1;

type CachedNewsPayload = {
  articles: RelatedNewsArticle[];
  digestBriefing: RelatedNewsDigestBriefing | null;
  digestStatus: RelatedNewsDigestStatus | null;
};

export function ExploreView({ inputs, model, assetPortfolio, assetPortfolioLoaded }: ExploreViewProps) {
  const [articles, setArticles] = useState<RelatedNewsArticle[]>([]);
  const [digestBriefing, setDigestBriefing] = useState<RelatedNewsDigestBriefing | null>(null);
  const [digestStatus, setDigestStatus] = useState<RelatedNewsDigestStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const newsInputs = useMemo(() => getAssetPortfolioNewsInputs(assetPortfolio), [assetPortfolio]);
  const { assetNames, tickers } = newsInputs;
  const candidateQueries = useMemo(
    () =>
      model.allocations.flatMap((allocation) => {
        const queries = allocation.candidates
          .slice(0, NEWS_CANDIDATES_PER_CATEGORY)
          .map((candidate) => candidate.query)
          .filter(Boolean);
        return queries.length > 0 ? queries : [allocation.label];
      }),
    [model.allocations],
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
  const digestBadge = digestStatus?.status === "success" ? "Gemini" : digestBriefing ? "기사 기반" : "Gemini";

  useEffect(() => {
    let ignore = false;

    async function fetchRelatedNews() {
      if (!assetPortfolioLoaded) {
        setIsLoading(true);
        return;
      }

      setIsLoading(true);
      setError(null);
      setArticles([]);
      setDigestBriefing(null);
      setDigestStatus(null);

      try {
        const canUseLocalCache = refreshCount === 0;
        const cachedNews = canUseLocalCache ? readCachedNews(cacheKey) : null;
        if (cachedNews) {
          setArticles(cachedNews.articles);
          setDigestBriefing(cachedNews.digestBriefing);
          setDigestStatus(cachedNews.digestStatus);
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
        setDigestBriefing(newsResponse.digestBriefing ?? null);
        setDigestStatus(newsResponse.digestStatus ?? null);
        if (newsResponse.articles.length > 0 || newsResponse.digestBriefing) {
          writeCachedNews(cacheKey, {
            articles: newsResponse.articles,
            digestBriefing: newsResponse.digestBriefing ?? null,
            digestStatus: newsResponse.digestStatus ?? null,
          });
        }
      } catch (newsError) {
        if (ignore) return;
        console.warn("Failed to load related news.", newsError);
        setArticles([]);
        setDigestBriefing(null);
        setDigestStatus(null);
        setError(newsError instanceof Error ? newsError.message : NEWS_ERROR_MESSAGE);
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
          새로고침
          <RotateCw size={11} className={isLoading ? "animate-spin" : undefined} />
        </button>
      </div>
      <div className="mb-4">
        <p className="mb-1 text-[10px] text-slate-400">
          현재 나의 보유 종목과 {riskLabels[inputs.riskProfile]} 투자 성향을 기반으로 선별한 관련 뉴스입니다.
        </p>
        <p className="text-[9px] font-semibold text-blue-300">네이버 뉴스 검색 API 기준으로 2시간마다 갱신합니다.</p>
      </div>

      <div className="mb-4 rounded-2xl bg-slate-900 p-4 text-white shadow-lg">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-xs font-extrabold">보유자산 AI 브리핑</h3>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[8px] font-bold text-blue-100">{digestBadge}</span>
        </div>
        {isLoading ? (
          <p className="rounded-xl bg-white/10 px-3 py-2 text-[10px] leading-relaxed text-slate-300">
            브리핑을 불러오는 중입니다.
          </p>
        ) : digestBriefing ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-white/10 px-3 py-2.5">
              <strong className="mb-1 block text-[11px] text-white">{digestBriefing.title}</strong>
              <p className="break-words text-[10px] leading-relaxed text-slate-300">{digestBriefing.overview}</p>
            </div>
            {digestBriefing.newsHighlights?.length ? (
              <div>
                <span className="mb-1.5 block text-[9px] font-extrabold text-blue-200">주요 뉴스</span>
                <ul className="space-y-1.5">
                  {digestBriefing.newsHighlights.slice(0, 3).map((highlight) => (
                    <li key={highlight} className="break-words rounded-lg bg-white/10 px-3 py-1.5 text-[10px] leading-relaxed text-slate-300">
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="rounded-xl bg-white/10 px-3 py-2.5">
              <span className="mb-1 block text-[9px] font-extrabold text-blue-200">포트폴리오 영향</span>
              <p className="break-words text-[10px] leading-relaxed text-slate-300">{digestBriefing.portfolioImpact}</p>
            </div>
            {digestBriefing.watchPoints.length > 0 ? (
              <ul className="space-y-1.5">
                {digestBriefing.watchPoints.map((point) => (
                  <li key={point} className="break-words rounded-lg bg-white/10 px-3 py-1.5 text-[10px] leading-relaxed text-slate-300">
                    {point}
                  </li>
                ))}
              </ul>
            ) : null}
            {digestBriefing.relatedAssets.length > 0 ? (
              <p className="break-words text-[9px] font-semibold text-slate-400">관련 자산: {digestBriefing.relatedAssets.join(" · ")}</p>
            ) : null}
            {digestStatus?.status !== "success" && digestStatus?.reason ? (
              <p className="break-words rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[9px] leading-relaxed text-amber-200">
                기사 기반 브리핑 표시 중: {digestStatus.reason}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="rounded-xl bg-white/10 px-3 py-2 text-[10px] leading-relaxed text-slate-300">
            {digestStatus?.reason ?? "브리핑할 보유자산 뉴스가 없습니다."}
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
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort();
}

function readCachedNews(cacheKey: string): CachedNewsPayload | null {
  try {
    const rawValue = localStorage.getItem(cacheKey);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as CachedNewsPayload & { cachedAt?: number };
    const parsedArticles = Array.isArray(parsed.articles) ? parsed.articles : [];
    const parsedDigestBriefing = isDigestBriefing(parsed.digestBriefing) ? parsed.digestBriefing : null;
    if (parsedArticles.length === 0 && !parsedDigestBriefing) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    const cacheTtlMs = getNewsCacheTtlMs(parsed.digestStatus, parsedArticles.length);
    if (!parsed.cachedAt || Date.now() - parsed.cachedAt > cacheTtlMs) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return {
      articles: parsedArticles,
      digestBriefing: parsedDigestBriefing,
      digestStatus: parsed.digestStatus ?? null,
    };
  } catch {
    localStorage.removeItem(cacheKey);
    return null;
  }
}

function getNewsCacheTtlMs(status: RelatedNewsDigestStatus | null, articleCount: number) {
  if (status?.status === "failed") {
    if (status.retryAfterSeconds) {
      return Math.min(status.retryAfterSeconds * 1000 + NEWS_RETRY_CACHE_GRACE_MS, NEWS_SHORT_CACHE_TTL_MS);
    }
    return NEWS_SHORT_CACHE_TTL_MS;
  }
  return articleCount === 0 ? NEWS_SHORT_CACHE_TTL_MS : NEWS_CACHE_TTL_MS;
}

function isDigestBriefing(value: unknown): value is RelatedNewsDigestBriefing {
  if (!value || typeof value !== "object") return false;
  const briefing = value as Partial<RelatedNewsDigestBriefing>;
  return (
    typeof briefing.title === "string" &&
    typeof briefing.overview === "string" &&
    Array.isArray(briefing.newsHighlights) &&
    typeof briefing.portfolioImpact === "string" &&
    Array.isArray(briefing.watchPoints) &&
    Array.isArray(briefing.relatedAssets)
  );
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
        <p className="break-words text-xs font-bold leading-relaxed text-slate-100">{article.title}</p>
        <p className="mt-1 break-words text-[9px] leading-relaxed text-slate-400">{article.summary}</p>
      </div>
    </a>
  );
}
