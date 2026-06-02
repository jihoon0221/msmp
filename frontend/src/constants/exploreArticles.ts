import type { ExploreArticle, RiskProfile } from "../types/domain";

export const exploreArticles: Record<RiskProfile, ExploreArticle[]> = {
  aggressive: [
    {
      title: "엔비디아·오픈AI 글로벌 빅테크가 주목한 AI 인프라 경쟁",
      tag: "트렌드",
      source: "한국경제",
      desc: "AI 설비 투자와 데이터센터 확장 흐름을 공격형 포트폴리오 관점에서 점검합니다.",
      icon: "Rocket",
      link: "https://www.hankyung.com/article/2026011383017",
    },
    {
      title: "K반도체와 글로벌 데이터센터 투자 사이클",
      tag: "심층 분석",
      source: "한경매거진",
      desc: "반도체 공급망과 빅테크 CAPEX 증가가 성장 ETF에 미치는 영향을 봅니다.",
      icon: "Factory",
      link: "https://magazine.hankyung.com/business/article/202602270298b",
    },
    {
      title: "S&P500을 웃돈 미국 ETF 선별 기준",
      tag: "포트폴리오",
      source: "한국경제",
      desc: "초과수익 ETF를 볼 때 비용, 추적오차, 변동성 관리 기준을 함께 검토합니다.",
      icon: "TrendingUp",
      link: "https://www.hankyung.com/article/202501083845i",
    },
  ],
  neutral: [
    {
      title: "월 배당 ETF로 만드는 투자 현금흐름",
      tag: "배당 정보",
      source: "한국경제",
      desc: "분배금 기반 상품을 중립형 포트폴리오의 완충 장치로 활용하는 방법입니다.",
      icon: "Repeat",
      link: "https://www.hankyung.com/article/2026011873801",
    },
    {
      title: "대표 배당주 ETF 활용법",
      tag: "투자 전략",
      source: "한국경제",
      desc: "배당 ETF의 방어력과 장기 수익률을 균형 있게 비교합니다.",
      icon: "ShieldHalf",
      link: "https://www.hankyung.com/article/2026011369611",
    },
    {
      title: "미국 주배당 ETF 출시 흐름",
      tag: "시장 전망",
      source: "한국경제",
      desc: "분배 주기가 짧아지는 ETF 시장의 장단점을 살펴봅니다.",
      icon: "CalendarCheck",
      link: "https://www.hankyung.com/article/2025123033181",
    },
  ],
  stable: [
    {
      title: "저금리 시대 파킹통장 비교 포인트",
      tag: "자금 유동성",
      source: "한경매거진",
      desc: "안정형 투자자가 단기 자금을 보관할 때 확인해야 할 금리와 한도 조건입니다.",
      icon: "Vault",
      link: "https://magazine.hankyung.com/business/article/202506260892b",
    },
    {
      title: "하루만 맡겨도 이자가 붙는 단기 자금 전략",
      tag: "투자 가이드",
      source: "한국경제",
      desc: "목표 기한이 짧은 자금은 입출금 자유도와 세후 수익률을 함께 봐야 합니다.",
      icon: "PiggyBank",
      link: "https://www.hankyung.com/article/2024032029381",
    },
    {
      title: "예적금 금리 하락기 단기자금 운용",
      tag: "금리 안내",
      source: "한국경제",
      desc: "금리 방향성과 만기 분산을 안정형 자산관리 관점에서 정리합니다.",
      icon: "FileText",
      link: "https://www.hankyung.com/article/2025030403661",
    },
  ],
};

