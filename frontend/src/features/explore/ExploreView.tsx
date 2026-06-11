import {
  FileText,
  RotateCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "../../components/ui/Card";
import type { RelatedNewsArticle } from "../../constants/exploreArticles";
import type { RiskProfile } from "../../types/domain";

type ExploreViewProps = {
  riskProfile: RiskProfile; 
};

const riskLabels: Record<RiskProfile, string> = {
  aggressive: "공격형",
  neutral: "중립형",
  stable: "안정형",
};

const RELATED_NEWS_URL = "http://127.0.0.1:8000/api/news/related?tickers=NVDA,TSLA,005930.KS";
const NEWS_ERROR_MESSAGE = "뉴스를 불러오지 못했습니다. 백엔드 서버 또는 API 키를 확인해주세요.";

export function ExploreView({ riskProfile }: ExploreViewProps) {
  const [articles, setArticles] = useState<RelatedNewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchRelatedNews() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(RELATED_NEWS_URL, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`News API returned ${response.status}`);
        }

        const data = (await response.json()) as { articles?: RelatedNewsArticle[] };
        if (!Array.isArray(data.articles)) {
          throw new Error("Invalid news API response");
        }

        setArticles(data.articles);
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        setArticles([]);
        setError(NEWS_ERROR_MESSAGE);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void fetchRelatedNews();
    return () => controller.abort();
  }, [refreshCount]);

  return (
    <main className="no-scrollbar flex-1 overflow-y-auto bg-slate-50 px-5 py-5 pb-24">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-xl font-black">보유 자산 관련 뉴스</h2>
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => setRefreshCount((value) => value + 1)}
          disabled={isLoading}
        >
          다른 기사
          <RotateCw size={11} className={isLoading ? "animate-spin" : undefined} />
        </button>
      </div>
      <div className="mb-4">
        <p className="mb-1 text-[10px] text-slate-500">
          현재 나의 보유 종목 코드와 {riskLabels[riskProfile]} 투자 성향을 기반으로 선별한 관련 뉴스입니다.
        </p>
        <p className="text-[9px] font-semibold text-blue-500">네이버 뉴스 검색 API에서 최신 관련 기사를 가져옵니다.</p>
      </div>


      <Card>
        <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold text-slate-800">보유 종목 기반 관련 기사</h3>
        {isLoading ? (
          <p className="py-6 text-center text-xs text-slate-400">관련 뉴스를 불러오는 중입니다.</p>
        ) : error ? (
          <p className="py-6 text-center text-xs text-red-500">{error}</p>
        ) : articles.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">표시할 관련 뉴스가 없습니다.</p>
        ) : (
          <ul className="space-y-3.5">
            {articles.map((article) => (
              <li key={`${article.ticker}-${article.link}`}>
                <ArticleRow article={article} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}

function ArticleRow({ article }: { article: RelatedNewsArticle }) {
  return (
    <a className="flex gap-3 rounded-xl border border-slate-100 bg-white p-2.5 transition hover:bg-slate-50" href={article.link} target="_blank" rel="noreferrer">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        <FileText size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <span className="text-[8px] font-extrabold text-slate-400">
          {article.ticker} · {article.source}
          </span>
          <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[8px] font-bold text-blue-600">원문</span>
        </div>
        <p className="line-clamp-2 text-xs font-bold text-slate-800">{article.title}</p>
        <p className="mt-1 line-clamp-2 text-[9px] text-slate-400">{article.summary}</p>
      </div>
    </a>
  );
}

