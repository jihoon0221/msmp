import {
  CalendarCheck,
  Factory,
  FileText,
  PiggyBank,
  Repeat,
  Rocket,
  RotateCw,
  ShieldHalf,
  TrendingUp,
  Vault,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Card } from "../../components/ui/Card";
import { exploreArticles } from "../../constants/exploreArticles";
import type { ExploreArticle, RiskProfile } from "../../types/domain";

type ExploreViewProps = {
  riskProfile: RiskProfile;
};

const riskLabels: Record<RiskProfile, string> = {
  aggressive: "공격형",
  neutral: "중립형",
  stable: "안정형",
};

const iconMap: Record<string, LucideIcon> = {
  Rocket,
  Factory,
  TrendingUp,
  Repeat,
  ShieldHalf,
  CalendarCheck,
  Vault,
  PiggyBank,
  FileText,
};

export function ExploreView({ riskProfile }: ExploreViewProps) {
  const [offset, setOffset] = useState(0);
  const articles = exploreArticles[riskProfile];
  const visibleArticles = useMemo(
    () => Array.from({ length: articles.length }, (_, index) => articles[(offset + index) % articles.length]),
    [articles, offset],
  );
  const [main, ...list] = visibleArticles;

  return (
    <main className="no-scrollbar flex-1 overflow-y-auto bg-slate-50 px-5 py-5 pb-24">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-xl font-black">AI 금융 지식인</h2>
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600 transition-colors hover:bg-blue-100"
          onClick={() => setOffset((value) => (value + 1) % articles.length)}
        >
          다른 기사
          <RotateCw size={11} />
        </button>
      </div>
      <div className="mb-4">
        <p className="mb-1 text-[10px] text-slate-500">
          현재 나의 <span className="font-bold text-blue-600">{riskLabels[riskProfile]}</span> 포트폴리오 기준 학습 콘텐츠입니다.
        </p>
        <p className="text-[9px] font-semibold text-blue-500">실서비스에서는 외부 뉴스 API 또는 Supabase Edge Function으로 자동 갱신합니다.</p>
      </div>

      <ArticleHero article={main} />

      <Card>
        <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold text-slate-800">포트폴리오 정밀 맞춤 지식 뉴스</h3>
        <ul className="space-y-3.5">
          {list.map((article) => (
            <li key={article.title}>
              <ArticleRow article={article} />
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}

function ArticleHero({ article }: { article: ExploreArticle }) {
  return (
    <a
      className="mb-4 flex w-full items-center justify-between rounded-xl border border-slate-100 bg-white p-3 text-left transition hover:bg-slate-50"
      href={article.link}
      target="_blank"
      rel="noreferrer"
    >
      <div className="min-w-0 flex-1 pr-2">
        <span className="mb-1.5 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[8px] font-extrabold text-red-800">
          {article.source} · {article.tag}
        </span>
        <p className="line-clamp-2 text-xs font-bold text-slate-800">{article.title}</p>
        <p className="line-clamp-1 mt-1 text-[9px] text-slate-400">{article.desc}</p>
      </div>
      <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[8px] font-bold text-blue-600">원문</span>
    </a>
  );
}

function ArticleRow({ article }: { article: ExploreArticle }) {
  const Icon = iconMap[article.icon] ?? FileText;

  return (
    <a className="flex gap-3 rounded-xl border border-slate-100 bg-white p-2.5 transition hover:bg-slate-50" href={article.link} target="_blank" rel="noreferrer">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <span className="text-[8px] font-extrabold text-slate-400">
            {article.source} · {article.tag}
          </span>
          <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[8px] font-bold text-blue-600">원문</span>
        </div>
        <p className="line-clamp-2 text-xs font-bold text-slate-800">{article.title}</p>
      </div>
    </a>
  );
}

