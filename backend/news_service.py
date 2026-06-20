import html
import os
import re
from pathlib import Path
from datetime import UTC, datetime
from uuid import uuid4

import requests
from dotenv import load_dotenv
from schemas import RelatedNewsArticle, RelatedNewsRequest, RelatedNewsResponse


NAVER_NEWS_API_URL = "https://openapi.naver.com/v1/search/news.json"
TICKER_KEYWORDS = {
    "NVDA": "엔비디아",
    "TSLA": "테슬라",
    "005930.KS": "삼성전자",
}

load_dotenv(Path(__file__).with_name(".env"))


class NewsServiceError(RuntimeError):
    pass


def _remove_html(value):
    return html.unescape(re.sub(r"<[^>]+>", "", value or "")).strip()


def get_related_news(tickers, display=1):
    client_id = os.getenv("NAVER_CLIENT_ID")
    client_secret = os.getenv("NAVER_CLIENT_SECRET")
    print(f"NAVER_CLIENT_ID loaded: {bool(client_id)}", flush=True)
    print(f"NAVER_CLIENT_SECRET loaded: {bool(client_secret)}", flush=True)

    if not client_id or not client_secret:
        raise NewsServiceError("NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다.")

    headers = {
        "X-Naver-Client-Id": client_id,
        "X-Naver-Client-Secret": client_secret,
    }
    articles = []

    for ticker in tickers:
        try:
            query = TICKER_KEYWORDS.get(ticker, ticker)
            print(f"Naver news query: {query}", flush=True)
            response = requests.get(
                NAVER_NEWS_API_URL,
                headers=headers,
                params={
                    "query": query,
                    "display": display,
                    "sort": "date",
                },
                timeout=5,
            )
            print(f"Naver API status code: {response.status_code}", flush=True)
            print(f"Naver API response: {response.text[:300]}", flush=True)
            response.raise_for_status()
            items = response.json().get("items", [])

            if not items:
                continue

            for item in items:
                articles.append(
                    {
                        "ticker": ticker,
                        "source": "네이버 뉴스",
                        "title": _remove_html(item.get("title")),
                        "summary": _remove_html(item.get("description")),
                        "link": item.get("originallink") or item.get("link") or "https://news.naver.com/",
                    }
                )
        except (requests.RequestException, ValueError) as exc:
            print(f"Naver API exception: {exc}", flush=True)
            raise NewsServiceError("네이버 뉴스 API 요청에 실패했습니다.") from exc

    return {"articles": articles}


def get_related_news_v1(request: RelatedNewsRequest) -> RelatedNewsResponse:
    keywords = _build_news_keywords(request)
    if not keywords:
        return RelatedNewsResponse(articles=[])

    legacy_articles = get_related_news(keywords, display=request.limitPerKeyword)
    fetched_at = datetime.now(UTC).isoformat()

    articles = [
        RelatedNewsArticle(
            id=f"news_{uuid4().hex}",
            matchedKeyword=article.get("ticker", ""),
            ticker=article.get("ticker"),
            source=article.get("source", "네이버 뉴스"),
            title=article.get("title", ""),
            summary=article.get("summary", ""),
            url=article.get("link", ""),
            publishedAt=None,
            fetchedAt=fetched_at,
        )
        for article in legacy_articles.get("articles", [])
    ]

    return RelatedNewsResponse(articles=articles)


def _build_news_keywords(request: RelatedNewsRequest) -> list[str]:
    keywords = []

    for ticker in request.tickers:
        if ticker and ticker not in keywords:
            keywords.append(ticker)

    for name in request.assetNames:
        if name and name not in keywords:
            keywords.append(name)

    if request.goalType:
        goal_keyword = {
            "jeonse": "전세자금 투자",
            "seed": "목돈 마련 투자",
            "car": "자동차 구매 자금",
            "wedding": "결혼자금 투자",
            "other": "재무 목표 투자",
        }[request.goalType.value]
        if goal_keyword not in keywords:
            keywords.append(goal_keyword)

    if request.riskProfile:
        risk_keyword = {
            "stable": "안정형 ETF",
            "neutral": "중립형 포트폴리오",
            "aggressive": "성장형 ETF",
        }[request.riskProfile.value]
        if risk_keyword not in keywords:
            keywords.append(risk_keyword)

    return keywords
