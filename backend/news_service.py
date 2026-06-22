import html
import json
import logging
import os
import re
from pathlib import Path
from datetime import UTC, datetime
from uuid import uuid4

import requests
from dotenv import load_dotenv
from schemas import (
    RelatedNewsArticle,
    RelatedNewsDigestBriefing,
    RelatedNewsDigestStatus,
    RelatedNewsRequest,
    RelatedNewsResponse,
)


logger = logging.getLogger(__name__)
NAVER_NEWS_API_URL = "https://openapi.naver.com/v1/search/news.json"
GEMINI_GENERATE_CONTENT_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
GEMINI_DIGEST_TIMEOUT_SECONDS = 15
GEMINI_DIGEST_MAX_OUTPUT_TOKENS = 1024
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
            response.encoding = "utf-8"
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
    briefing_articles = holding_articles or legacy_article_items
    digest_briefing, digest_status = generate_news_briefing(briefing_articles, request)

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

    return RelatedNewsResponse(
        articles=articles,
        digestBriefing=digest_briefing,
        digestStatus=digest_status,
    )


def generate_news_briefing(
    articles: list[dict],
    request: RelatedNewsRequest,
) -> tuple[RelatedNewsDigestBriefing | None, RelatedNewsDigestStatus]:
    if not articles:
        return None, RelatedNewsDigestStatus(
            status="skipped",
            reason="브리핑할 관련 뉴스가 없습니다.",
        )

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("AI_API_KEY")
    if not api_key:
        briefing = _build_briefing_fallback(articles)
        return briefing, RelatedNewsDigestStatus(
            status="skipped",
            reason="GEMINI_API_KEY가 없어 기사 기반 브리핑을 표시합니다.",
        )

    prompt = _build_briefing_prompt(articles, request)
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
                    "maxOutputTokens": GEMINI_DIGEST_MAX_OUTPUT_TOKENS,
                },
            },
            timeout=GEMINI_DIGEST_TIMEOUT_SECONDS,
        )
        if not response.ok:
            logger.warning("Gemini digest failed: %s %s", response.status_code, response.text[:300])
            return _build_briefing_fallback(articles), RelatedNewsDigestStatus(
                status="failed",
                reason=f"Gemini API 오류 {response.status_code}: 기사 기반 브리핑을 표시합니다.",
            )

        data = response.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        briefing = _parse_digest_briefing(text, articles)
        if briefing:
            return briefing, RelatedNewsDigestStatus(status="success")

        logger.warning("Gemini digest response was not parseable: %s", text[:500])
        return _build_briefing_from_gemini_text(text, articles), RelatedNewsDigestStatus(status="success")
    except (requests.RequestException, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        logger.warning("Gemini digest generation failed", exc_info=True)
        return _build_briefing_fallback(articles), RelatedNewsDigestStatus(
            status="failed",
            reason=f"Gemini 브리핑 생성 실패: {type(exc).__name__}",
        )


def _build_briefing_prompt(articles: list[dict], request: RelatedNewsRequest) -> str:
    article_lines = []
    for article in articles[:8]:
        title = _truncate_text(article.get("title", ""), 100)
        summary = _truncate_text(article.get("summary", ""), 140)
        article_lines.append(f"- 자산: {article.get('ticker', '')}\n  제목: {title}\n  내용: {summary}")

    risk_label = {
        "stable": "안정형",
        "neutral": "중립형",
        "aggressive": "공격형",
    }.get(request.riskProfile.value if request.riskProfile else "", "미지정")
    goal_label = {
        "jeonse": "전세자금",
        "seed": "목돈 마련",
        "car": "자동차 구매",
        "wedding": "결혼자금",
        "other": "사용자 지정 목표",
    }.get(request.goalType.value if request.goalType else "", "미지정")

    return (
        "아래 뉴스들을 사용자의 보유자산과 추천 후보상품 관점에서 PB 브리핑으로 요약해라.\n"
        "매수/매도 지시처럼 단정하지 말고, 포트폴리오 영향과 확인할 점을 설명해라.\n"
        "한국어로 자연스럽고 간결하게 작성하라. 마크다운 없이 아래 5줄 형식으로만 응답해라.\n"
        f"투자성향: {risk_label}\n"
        f"목표: {goal_label}\n"
        "응답 형식:\n"
        "제목: 18자 이내 제목\n"
        "핵심: 핵심 이슈 한 문장\n"
        "영향: 포트폴리오 영향 한 문장\n"
        "확인점: 확인점 1 / 확인점 2\n"
        "관련자산: 자산명 1 / 자산명 2\n\n"
        + "\n\n".join(article_lines)
    )


def _parse_digest_briefing(value: str, articles: list[dict]) -> RelatedNewsDigestBriefing | None:
    text = _strip_json_fence(value)
    try:
        parsed = json.loads(_extract_json_object(text))
    except json.JSONDecodeError:
        return _parse_labeled_briefing(text, articles)

    if not isinstance(parsed, dict):
        return None

    title = str(parsed.get("title") or "보유자산 뉴스 브리핑").strip()
    overview = str(parsed.get("overview") or parsed.get("summary") or "").strip()
    portfolio_impact = str(parsed.get("portfolioImpact") or parsed.get("portfolio_impact") or parsed.get("impact") or "").strip()
    watch_points = parsed.get("watchPoints") or parsed.get("watch_points") or []
    related_assets = parsed.get("relatedAssets") or parsed.get("related_assets") or []

    if not overview or not portfolio_impact:
        return None

    return RelatedNewsDigestBriefing(
        title=_truncate_text(title, 24),
        overview=_ensure_sentence(_truncate_text(overview, 90)),
        portfolioImpact=_ensure_sentence(_truncate_text(portfolio_impact, 90)),
        watchPoints=_normalize_string_list(watch_points, ["단기 뉴스보다 실적 흐름 확인", "금리와 환율 변화 함께 점검"], 3, 32),
        relatedAssets=_normalize_string_list(related_assets, [article.get("ticker", "") for article in articles], 6, 24),
    )


def _parse_labeled_briefing(value: str, articles: list[dict]) -> RelatedNewsDigestBriefing | None:
    fields: dict[str, str] = {}
    ordered_values = []
    for raw_line in value.splitlines():
        line = raw_line.strip(" -")
        if ":" not in line:
            continue
        key, text = line.split(":", 1)
        cleaned_text = text.strip()
        fields[key.strip()] = cleaned_text
        if cleaned_text:
            ordered_values.append(cleaned_text)

    title = fields.get("제목") or fields.get("title") or (ordered_values[0] if ordered_values else "")
    overview = fields.get("핵심") or fields.get("overview") or fields.get("요약") or (
        ordered_values[1] if len(ordered_values) > 1 else ""
    )
    portfolio_impact = fields.get("영향") or fields.get("portfolioImpact") or fields.get("impact") or (
        ordered_values[2] if len(ordered_values) > 2 else "추천 후보상품의 상품 구조와 비용, 시장 흐름을 함께 확인하는 것이 좋습니다."
    )
    if not overview:
        return None

    watch_points = re.split(r"\s*/\s*|,\s*", fields.get("확인점", ""))
    related_assets = re.split(r"\s*/\s*|,\s*", fields.get("관련자산", ""))

    return RelatedNewsDigestBriefing(
        title=_truncate_text(title or "보유자산 뉴스 브리핑", 24),
        overview=_ensure_sentence(_truncate_text(overview, 90)),
        portfolioImpact=_ensure_sentence(_truncate_text(portfolio_impact, 90)),
        watchPoints=_normalize_string_list(watch_points, ["단기 뉴스보다 실적 흐름 확인", "금리와 환율 변화 함께 점검"], 3, 32),
        relatedAssets=_normalize_string_list(related_assets, [article.get("ticker", "") for article in articles], 6, 24),
    )


def _build_briefing_fallback(articles: list[dict]) -> RelatedNewsDigestBriefing:
    related_assets = _normalize_string_list([article.get("ticker", "") for article in articles], [], 6, 24)
    first_article = articles[0]
    overview = first_article.get("summary") or first_article.get("title") or "보유자산 관련 뉴스가 포착됐습니다."

    return RelatedNewsDigestBriefing(
        title="보유자산 뉴스 브리핑",
        overview=_ensure_sentence(_truncate_text(overview, 90)),
        portfolioImpact="단일 기사보다 실적·금리·환율 흐름을 함께 확인하는 것이 좋습니다.",
        watchPoints=["단기 뉴스보다 실적 흐름 확인", "금리와 환율 변화 함께 점검"],
        relatedAssets=related_assets,
    )


def _build_briefing_from_gemini_text(value: str, articles: list[dict]) -> RelatedNewsDigestBriefing:
    lines = [
        line.strip(" -")
        for line in _strip_json_fence(value).splitlines()
        if line.strip(" -")
    ]
    cleaned_lines = []
    for line in lines:
        if ":" in line:
            _, text = line.split(":", 1)
            line = text.strip()
        if line:
            cleaned_lines.append(line)

    overview = cleaned_lines[1] if len(cleaned_lines) > 1 else cleaned_lines[0] if cleaned_lines else ""
    if not overview:
        overview = articles[0].get("summary") or articles[0].get("title") or "관련 뉴스 흐름을 확인했습니다."

    return RelatedNewsDigestBriefing(
        title=_truncate_text(cleaned_lines[0] if cleaned_lines else "보유자산 뉴스 브리핑", 24),
        overview=_ensure_sentence(_truncate_text(overview, 90)),
        portfolioImpact="추천 후보상품의 상품 구조와 비용, 시장 흐름을 함께 확인하는 것이 좋습니다.",
        watchPoints=["상품 비용과 추적지수 확인", "금리와 환율 변화 함께 점검"],
        relatedAssets=_normalize_string_list([article.get("ticker", "") for article in articles], [], 6, 24),
    )


def _normalize_string_list(value, fallback: list[str], max_items: int, max_length: int) -> list[str]:
    candidates = value if isinstance(value, list) else fallback
    normalized = []
    seen = set()
    for item in candidates:
        text = _truncate_text(str(item or "").strip(), max_length)
        key = text.casefold()
        if text and key not in seen:
            seen.add(key)
            normalized.append(text)
        if len(normalized) >= max_items:
            break
    return normalized


def _strip_json_fence(value: str) -> str:
    text = value.strip().removeprefix("\ufeff").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _extract_json_object(value: str) -> str:
    text = value.strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return text
    return text[start : end + 1]


def _truncate_text(value: str, max_length: int) -> str:
    text = " ".join(str(value or "").split()).strip()
    if len(text) <= max_length:
        return text
    return text[:max_length].rstrip(" ,·-")


def _ensure_sentence(value: str) -> str:
    text = value.strip()
    if not text:
        return text
    if text.endswith((".", "!", "?", "다.", "요.", "니다.")):
        return text
    return text + "."


def _build_news_keywords(request: RelatedNewsRequest) -> list[str]:
    keywords = []

    for name in request.assetNames:
        if name and name not in keywords:
            keywords.append(name)

    for ticker in request.tickers:
        keyword = TICKER_KEYWORDS.get(ticker, ticker)
        if keyword and keyword not in keywords:
            keywords.append(keyword)

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
        for keyword in [
            *[TICKER_KEYWORDS.get(ticker, ticker) for ticker in request.tickers],
            *request.assetNames,
        ]
        if keyword and keyword.strip()
    }
