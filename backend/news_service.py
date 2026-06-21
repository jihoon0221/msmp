import html
import json
import os
import re
from datetime import UTC, datetime
from uuid import uuid4

import requests
from config import is_env_set
from schemas import RelatedNewsArticle, RelatedNewsDigestStatus, RelatedNewsRequest, RelatedNewsResponse


NAVER_NEWS_API_URL = "https://openapi.naver.com/v1/search/news.json"
GEMINI_GENERATE_CONTENT_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
TICKER_KEYWORDS = {
    "NVDA": "엔비디아",
    "TSLA": "테슬라",
    "005930.KS": "삼성전자",
}


class NewsServiceError(RuntimeError):
    pass


def _remove_html(value):
    return html.unescape(re.sub(r"<[^>]+>", "", value or "")).strip()


def get_related_news(tickers, display=1):
    client_id = os.getenv("NAVER_CLIENT_ID")
    client_secret = os.getenv("NAVER_CLIENT_SECRET")
    print(f"NAVER_CLIENT_ID loaded: {is_env_set('NAVER_CLIENT_ID')}", flush=True)
    print(f"NAVER_CLIENT_SECRET loaded: {is_env_set('NAVER_CLIENT_SECRET')}", flush=True)

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
        return RelatedNewsResponse(
            articles=[],
            digestStatus=RelatedNewsDigestStatus(
                status="skipped",
                reason="뉴스 검색 키워드가 없습니다.",
            ),
        )

    legacy_articles = get_related_news(keywords, display=request.limitPerKeyword)
    fetched_at = datetime.now(UTC).isoformat()
    legacy_article_items = legacy_articles.get("articles", [])
    holding_keywords = _build_holding_news_keywords(request)
    holding_articles = [
        article
        for article in legacy_article_items
        if article.get("ticker") in holding_keywords
    ]
    digest_summary, digest_status = generate_news_digest(holding_articles)

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
        for article in legacy_article_items
    ]

    return RelatedNewsResponse(articles=articles, digestSummary=digest_summary, digestStatus=digest_status)


def generate_news_digest(articles: list[dict]) -> tuple[list[dict], RelatedNewsDigestStatus]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not articles:
        return [], RelatedNewsDigestStatus(
            status="skipped",
            reason="보유 종목과 직접 매칭된 뉴스가 없습니다.",
        )
    if not api_key:
        return [], RelatedNewsDigestStatus(
            status="skipped",
            reason="GEMINI_API_KEY가 설정되지 않았습니다.",
        )

    grouped_articles: dict[str, list[dict]] = {}
    for article in articles:
        ticker = (article.get("ticker") or "").strip()
        if not ticker:
            continue
        grouped_articles.setdefault(ticker, []).append(article)

    if not grouped_articles:
        return [], RelatedNewsDigestStatus(
            status="skipped",
            reason="요약할 종목별 뉴스 그룹을 만들 수 없습니다.",
        )

    prompt = _build_digest_prompt(grouped_articles)

    try:
        response = requests.post(
            GEMINI_GENERATE_CONTENT_URL,
            params={"key": api_key},
            json={
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": prompt}],
                    }
                ],
                "generationConfig": {
                    "temperature": 0.2,
                    "responseMimeType": "application/json",
                },
            },
            timeout=8,
        )
        if not response.ok:
            return [], RelatedNewsDigestStatus(
                status="failed",
                reason=_format_gemini_http_error(response),
            )

        data = response.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(_strip_json_fence(text))

        if not isinstance(parsed, list):
            return [], RelatedNewsDigestStatus(
                status="failed",
                reason="Gemini 응답 형식이 올바르지 않습니다.",
            )

        digest_summary = []
        for item in parsed:
            if not isinstance(item, dict):
                continue
            ticker = str(item.get("ticker", "")).strip()
            summary = str(item.get("summary", "")).strip()
            if ticker and summary:
                digest_summary.append({"ticker": ticker, "summary": summary})

        if not digest_summary:
            return [], RelatedNewsDigestStatus(
                status="failed",
                reason="Gemini 응답에서 유효한 요약을 찾지 못했습니다.",
            )

        return digest_summary, RelatedNewsDigestStatus(status="success")
    except requests.Timeout as exc:
        print(f"Gemini digest generation failed: {exc}", flush=True)
        return [], RelatedNewsDigestStatus(
            status="failed",
            reason="Gemini 요청 시간이 초과되었습니다.",
        )
    except requests.RequestException as exc:
        print(f"Gemini digest generation failed: {exc}", flush=True)
        return [], RelatedNewsDigestStatus(
            status="failed",
            reason=f"Gemini API 연결에 실패했습니다. ({type(exc).__name__})",
        )
    except json.JSONDecodeError as exc:
        print(f"Gemini digest generation failed: {exc}", flush=True)
        return [], RelatedNewsDigestStatus(
            status="failed",
            reason="Gemini 응답을 JSON으로 해석하지 못했습니다.",
        )
    except (KeyError, TypeError, ValueError) as exc:
        print(f"Gemini digest generation failed: {exc}", flush=True)
        return [], RelatedNewsDigestStatus(
            status="failed",
            reason=f"Gemini 응답 구조가 예상과 다릅니다. ({type(exc).__name__})",
        )


def _build_digest_prompt(grouped_articles: dict[str, list[dict]]) -> str:
    sections = []
    for ticker, articles in grouped_articles.items():
        article_lines = []
        for article in articles[:5]:
            title = article.get("title", "")
            summary = article.get("summary", "")
            article_lines.append(f"- 제목: {title}\n  요약: {summary}")
        sections.append(f"종목: {ticker}\n" + "\n".join(article_lines))

    return (
        "아래 뉴스들을 종목별로 종합해라.\n"
        "각 종목당 20자 이내 한 줄 요약을 JSON 배열로만 응답해라.\n"
        "다른 텍스트, 인사말, 설명, 마크다운 코드블록은 절대 포함하지 마라.\n"
        '응답 형식: [{"ticker": "삼성전자", "summary": "..."}]\n\n'
        + "\n\n".join(sections)
    )


def _strip_json_fence(value: str) -> str:
    text = value.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _format_gemini_http_error(response: requests.Response) -> str:
    detail = ""
    try:
        payload = response.json()
        error = payload.get("error") if isinstance(payload, dict) else None
        if isinstance(error, dict):
            message = str(error.get("message") or "").strip()
            status = str(error.get("status") or "").strip()
            detail = " / ".join(value for value in [status, message] if value)
    except ValueError:
        detail = response.text[:160].strip()

    if detail:
        return f"Gemini API 오류 {response.status_code}: {detail}"

    return f"Gemini API 오류 {response.status_code}: 응답 본문이 비어 있습니다."


def _build_news_keywords(request: RelatedNewsRequest) -> list[str]:
    keywords = []

    for ticker in request.tickers:
        if ticker and ticker not in keywords:
            keywords.append(ticker)

    for name in request.assetNames:
        if name and name not in keywords:
            keywords.append(name)

    for query in request.candidateQueries:
        if query and query not in keywords:
            keywords.append(query)

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


def _build_holding_news_keywords(request: RelatedNewsRequest) -> set[str]:
    return {
        keyword.strip()
        for keyword in [*request.tickers, *request.assetNames]
        if keyword and keyword.strip()
    }
