export type RelatedNewsArticle = {
  ticker: string;
  title: string;
  source: string;
  summary: string;
  link: string;
};

export const relatedNewsArticles: RelatedNewsArticle[] = [
  {
    ticker: "NVDA",
    source: "한국경제",
    title: "엔비디아 AI 데이터센터 투자 확대",
    summary: "AI 반도체 수요 증가와 데이터센터 투자 확대 관련 기사",
    link: "https://www.hankyung.com/",
  },
  {
    ticker: "TSLA",
    source: "한국경제",
    title: "테슬라 전기차 시장 경쟁 심화",
    summary: "전기차 시장 점유율 변화와 성장주 흐름 분석",
    link: "https://www.hankyung.com/",
  },
  {
    ticker: "005930.KS",
    source: "한국경제",
    title: "삼성전자와 글로벌 반도체 투자 사이클",
    summary: "반도체 공급망 및 AI 서버 수요 증가 관련 기사",
    link: "https://www.hankyung.com/",
  },
];
