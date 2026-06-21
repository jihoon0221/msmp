import html
import json
import logging
import os
import re
import time
from datetime import UTC, datetime
from uuid import uuid4

import requests
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
RELATED_NEWS_CACHE_TTL_SECONDS = 2 * 60 * 60
RELATED_NEWS_FAILURE_CACHE_TTL_SECONDS = 10 * 60
RELATED_NEWS_CACHE_MAX_ENTRIES = 64
RELATED_NEWS_CACHE_VERSION = 9
NEWS_MAX_HOLDING_TICKERS = 4
NEWS_MAX_HOLDING_NAMES = 4
NEWS_MAX_CANDIDATE_QUERIES = 3
GEMINI_DIGEST_TIMEOUT_SECONDS = 15
GEMINI_DIGEST_MAX_OUTPUT_TOKENS = 640
DIGEST_MAX_GROUPS = 8
DIGEST_MAX_ARTICLES_PER_GROUP = 1
DIGEST_TITLE_MAX_LENGTH = 100
DIGEST_SUMMARY_MAX_LENGTH = 140
BRIEFING_TITLE_MAX_LENGTH = 20
BRIEFING_OVERVIEW_MAX_LENGTH = 72
BRIEFING_IMPACT_MAX_LENGTH = 72
BRIEFING_WATCH_POINT_MAX_LENGTH = 28
TICKER_KEYWORDS = {
    "NVDA": "엔비디아",
    "TSLA": "테슬라",
    "005930.KS": "삼성전자",
}
MARKET_SYMBOL_PATTERN = re.compile(r"^[A-Z0-9.]+$")

_RELATED_NEWS_CACHE: dict[str, tuple[float, int, RelatedNewsResponse]] = {}


class NewsServiceError(RuntimeError):
    pass


def _remove_html(value):
    return _clean_display_text(html.unescape(re.sub(r"<[^>]+>", "", value or "")))


def _fetch_related_news(tickers: list[str], display: int = 1):
    client_id = os.getenv("NAVER_CLIENT_ID")
    client_secret = os.getenv("NAVER_CLIENT_SECRET")

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
            logger.warning("Naver API request failed", exc_info=True)
            raise NewsServiceError("네이버 뉴스 API 요청에 실패했습니다.") from exc

    return {"articles": articles}


def get_related_news_v1(request: RelatedNewsRequest) -> RelatedNewsResponse:
    cache_key = _build_related_news_cache_key(request)
    cached_response = _read_related_news_cache(cache_key)
    if cached_response:
        return cached_response

    keywords = _build_news_keywords(request)
    if not keywords:
        return RelatedNewsResponse(
            articles=[],
            digestStatus=RelatedNewsDigestStatus(
                status="skipped",
                reason="뉴스 검색 키워드가 없습니다.",
            ),
        )

    legacy_articles = _fetch_related_news(keywords, display=request.limitPerKeyword)
    fetched_at = datetime.now(UTC).isoformat()
    legacy_article_items = legacy_articles.get("articles", [])
    holding_keywords = _build_holding_news_keywords(request)
    holding_articles = [
        article
        for article in legacy_article_items
        if article.get("ticker") in holding_keywords
    ]
    digest_briefing, digest_status = generate_news_briefing(holding_articles, request)

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

    response = RelatedNewsResponse(
        articles=articles,
        digestBriefing=digest_briefing,
        digestStatus=digest_status,
    )
    _write_related_news_cache(cache_key, response)
    return response


def generate_news_briefing(
    articles: list[dict],
    request: RelatedNewsRequest,
) -> tuple[RelatedNewsDigestBriefing | None, RelatedNewsDigestStatus]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not articles:
        return None, RelatedNewsDigestStatus(
            status="skipped",
            reason="보유 종목과 직접 매칭된 뉴스가 없습니다.",
        )
    if not api_key:
        logger.warning(
            "Gemini briefing skipped because GEMINI_API_KEY is not configured",
            extra={
                "article_count": len(articles),
                "ticker_count": len(request.tickers),
                "asset_name_count": len(request.assetNames),
            },
        )
        return None, RelatedNewsDigestStatus(
            status="skipped",
            reason="GEMINI_API_KEY가 설정되지 않았습니다.",
        )

    grouped_articles = _group_digest_articles(articles)

    if not grouped_articles:
        return None, RelatedNewsDigestStatus(
            status="skipped",
            reason="요약할 종목별 뉴스 그룹을 만들 수 없습니다.",
        )

    prompt = _build_briefing_prompt(grouped_articles, request)

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
                    "responseMimeType": "application/json",
                },
            },
            timeout=GEMINI_DIGEST_TIMEOUT_SECONDS,
        )
        if not response.ok:
            error_reason = _format_gemini_http_error(response)
            logger.warning(
                "Gemini digest generation returned non-2xx response",
                extra={
                    "status_code": response.status_code,
                    "reason": error_reason,
                    "article_count": len(articles),
                },
            )
            return None, RelatedNewsDigestStatus(
                status="failed",
                reason=error_reason,
            )

        data = response.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        briefing = _parse_digest_briefing(text, grouped_articles)

        if not briefing:
            return _build_briefing_fallback(
                grouped_articles,
                "Gemini 응답에서 유효한 브리핑을 찾지 못해 기사 기반 브리핑을 표시합니다.",
            )

        return briefing, RelatedNewsDigestStatus(status="success")
    except requests.Timeout as exc:
        logger.warning("Gemini digest generation timed out", exc_info=True)
        return _build_briefing_fallback(
            grouped_articles,
            "Gemini 요청 시간이 초과되어 기사 기반 브리핑을 표시합니다.",
        )
    except requests.RequestException as exc:
        logger.warning("Gemini digest generation request failed", exc_info=True)
        return None, RelatedNewsDigestStatus(
            status="failed",
            reason=f"Gemini API 연결에 실패했습니다. ({type(exc).__name__})",
        )
    except json.JSONDecodeError as exc:
        logger.warning("Gemini digest response was not valid JSON", exc_info=True)
        return _build_briefing_fallback(
            grouped_articles,
            "Gemini 응답이 JSON 형식이 아니어서 기사 기반 브리핑을 표시합니다.",
        )
    except (KeyError, TypeError, ValueError) as exc:
        logger.warning("Gemini digest response shape was unexpected", exc_info=True)
        return _build_briefing_fallback(
            grouped_articles,
            f"Gemini 응답 구조가 예상과 달라 기사 기반 브리핑을 표시합니다. ({type(exc).__name__})",
        )


def _group_digest_articles(articles: list[dict]) -> dict[str, list[dict]]:
    grouped_articles: dict[str, list[dict]] = {}
    for article in articles:
        ticker = (article.get("ticker") or "").strip()
        if not ticker:
            continue
        grouped_articles.setdefault(ticker, []).append(article)
    return grouped_articles


def _build_briefing_prompt(grouped_articles: dict[str, list[dict]], request: RelatedNewsRequest) -> str:
    sections = []
    for ticker, articles in list(grouped_articles.items())[:DIGEST_MAX_GROUPS]:
        article_lines = []
        for article in articles[:DIGEST_MAX_ARTICLES_PER_GROUP]:
            title = _truncate_prompt_text(article.get("title", ""), DIGEST_TITLE_MAX_LENGTH)
            summary = _truncate_prompt_text(article.get("summary", ""), DIGEST_SUMMARY_MAX_LENGTH)
            article_lines.append(f"- 제목: {title}\n  요약: {summary}")
        sections.append(f"종목: {ticker}\n" + "\n".join(article_lines))

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
    related_assets = ", ".join(list(grouped_articles)[:DIGEST_MAX_GROUPS])

    return (
        "아래 뉴스들을 종목별로 따로 요약하지 말고, 사용자의 보유자산 전체 관점에서 PB 브리핑을 작성해라.\n"
        "투자 매수/매도 지시처럼 단정하지 말고, 뉴스가 포트폴리오에 줄 수 있는 영향과 확인할 점을 설명해라.\n"
        "한국어로 자연스럽고 간결하게 작성하라.\n"
        "모든 문장은 완성된 문장으로 끝내라. 말이 끊기는 문장, 중간에서 끝나는 문장은 금지한다.\n"
        "마크다운 없이 JSON 객체만 응답해라.\n"
        f"투자성향: {risk_label}\n"
        f"목표: {goal_label}\n"
        f"관련 보유자산: {related_assets}\n"
        "길이 제한: title 18자 이내, overview 65자 이내 완성문 1문장, "
        "portfolioImpact 65자 이내 완성문 1문장, watchPoints 각 25자 이내.\n"
        "말줄임표, 생략 표시, 중간에서 끊긴 표현은 절대 쓰지 마라.\n"
        '응답 형식: {"title":"18자 이내 제목","overview":"65자 이내 핵심 이슈 한 문장.","portfolioImpact":"65자 이내 포트폴리오 영향 한 문장.","watchPoints":["25자 이내 확인점","25자 이내 확인점"],"relatedAssets":["자산명"]}\n\n'
        + "\n\n".join(sections)
    )


def _truncate_prompt_text(value: str, max_length: int) -> str:
    normalized = " ".join(str(value or "").split())
    if len(normalized) <= max_length:
        return normalized
    return normalized[:max_length].rstrip() + "..."


def _parse_digest_briefing(
    value: str,
    grouped_articles: dict[str, list[dict]],
) -> RelatedNewsDigestBriefing | None:
    parsed = _parse_gemini_json(value)
    if not isinstance(parsed, dict):
        return None

    related_assets = _normalize_briefing_string_list(
        parsed.get("relatedAssets") or parsed.get("related_assets") or parsed.get("assets"),
        fallback=list(grouped_articles)[:DIGEST_MAX_GROUPS],
        max_items=6,
        max_length=24,
    )
    watch_points = _normalize_briefing_string_list(
        parsed.get("watchPoints") or parsed.get("watch_points") or parsed.get("risks") or parsed.get("확인점"),
        fallback=[],
        max_items=3,
        max_length=BRIEFING_WATCH_POINT_MAX_LENGTH,
    )
    title = _truncate_display_text(
        str(parsed.get("title") or parsed.get("headline") or "보유자산 뉴스 브리핑"),
        BRIEFING_TITLE_MAX_LENGTH,
    )
    overview = _fit_complete_sentence(
        str(parsed.get("overview") or parsed.get("summary") or parsed.get("핵심") or ""),
        BRIEFING_OVERVIEW_MAX_LENGTH,
    )
    portfolio_impact = _fit_complete_sentence(
        str(parsed.get("portfolioImpact") or parsed.get("portfolio_impact") or parsed.get("impact") or parsed.get("영향") or ""),
        BRIEFING_IMPACT_MAX_LENGTH,
    )

    if not overview or not portfolio_impact:
        return None

    if not watch_points:
        watch_points = _default_watch_points()

    return RelatedNewsDigestBriefing(
        title=title,
        overview=overview,
        portfolioImpact=portfolio_impact,
        watchPoints=watch_points,
        relatedAssets=related_assets,
    )


def _build_briefing_fallback(
    grouped_articles: dict[str, list[dict]],
    reason: str,
) -> tuple[RelatedNewsDigestBriefing | None, RelatedNewsDigestStatus]:
    related_assets = list(grouped_articles)[:DIGEST_MAX_GROUPS]
    if not related_assets:
        return None, RelatedNewsDigestStatus(status="failed", reason=reason)

    asset_text = " · ".join(related_assets[:4])
    overview = f"{asset_text} 관련 뉴스가 포착됐습니다."

    briefing = RelatedNewsDigestBriefing(
        title="보유자산 뉴스 브리핑",
        overview=_fit_complete_sentence(overview, BRIEFING_OVERVIEW_MAX_LENGTH),
        portfolioImpact="단일 기사보다 실적·금리·환율 흐름을 함께 확인하는 것이 좋습니다.",
        watchPoints=_default_watch_points(),
        relatedAssets=related_assets[:6],
    )
    return briefing, RelatedNewsDigestStatus(status="skipped", reason=reason)


def _normalize_briefing_string_list(value, fallback: list[str], max_items: int, max_length: int) -> list[str]:
    if isinstance(value, list):
        candidates = value
    elif isinstance(value, str):
        candidates = re.split(r"[,·/]", value)
    else:
        candidates = fallback

    normalized = []
    seen = set()
    for item in candidates:
        text = _truncate_display_text(str(item), max_length)
        key = text.casefold()
        if text and key not in seen:
            seen.add(key)
            normalized.append(text)
        if len(normalized) >= max_items:
            break

    return normalized


def _default_watch_points() -> list[str]:
    return [
        "단기 뉴스보다 실적 흐름 확인",
        "금리와 환율 변화 함께 점검",
    ]


def _truncate_display_text(value: str, max_length: int) -> str:
    text = _clean_display_text(value)
    if len(text) <= max_length:
        return text

    truncated = text[:max_length].rstrip()
    boundary = truncated.rfind(" ")
    if boundary >= max_length * 0.6:
        truncated = truncated[:boundary].rstrip()

    return re.sub(r"\s?[A-Za-z0-9]{1,4}$", "", truncated).rstrip() or text[:max_length].rstrip()


def _fit_complete_sentence(value: str, max_length: int) -> str:
    text = _clean_display_text(value)
    if len(text) <= max_length:
        return _ensure_sentence_end(text)

    candidate = text[:max_length].rstrip()
    sentence_end = max(candidate.rfind("."), candidate.rfind("!"), candidate.rfind("?"), candidate.rfind("다."), candidate.rfind("요."))
    if sentence_end >= max_length * 0.45:
        return _ensure_sentence_end(candidate[: sentence_end + 1].rstrip())

    boundary = max(candidate.rfind(" "), candidate.rfind(","), candidate.rfind("·"))
    if boundary >= max_length * 0.55:
        candidate = candidate[:boundary].rstrip()

    return _ensure_sentence_end(candidate.rstrip(" ,·-"))


def _ensure_sentence_end(value: str) -> str:
    text = value.strip()
    if not text:
        return text
    if text.endswith((".", "!", "?", "다.", "요.", "니다.")):
        return text
    return text + "."


def _clean_display_text(value: str) -> str:
    text = " ".join(str(value or "").split())
    text = re.sub(r"(\.{2,}|…)+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip(" -·,")


def _parse_gemini_json(value: str):
    text = _strip_json_fence(value)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    extracted = _extract_json_fragment(text)
    if extracted:
        return json.loads(extracted)

    raise json.JSONDecodeError("No JSON object or array found", text, 0)


def _extract_json_fragment(value: str) -> str | None:
    candidates = [
        (value.find("["), value.rfind("]")),
        (value.find("{"), value.rfind("}")),
    ]
    valid_candidates = [(start, end) for start, end in candidates if start != -1 and end != -1 and end > start]
    if not valid_candidates:
        return None

    start, end = min(valid_candidates, key=lambda candidate: candidate[0])
    return value[start : end + 1]


def _strip_json_fence(value: str) -> str:
    text = value.strip().removeprefix("\ufeff").strip()
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

    if _is_gemini_quota_error(response.status_code, detail):
        return (
            "Gemini 플랜의 요청 한도에 도달해 AI 브리핑을 생성하지 못했습니다. "
            "잠시 후 다시 시도하거나 Gemini 사용량/결제 한도를 확인해주세요."
        )

    if detail:
        return f"Gemini API 오류 {response.status_code}: {detail}"

    return f"Gemini API 오류 {response.status_code}: 응답 본문이 비어 있습니다."


def _is_gemini_quota_error(status_code: int, detail: str) -> bool:
    normalized_detail = detail.lower()
    return status_code == 429 or any(
        marker in normalized_detail
        for marker in [
            "resource_exhausted",
            "quota",
            "rate limit",
            "rate_limit",
            "exceeded",
        ]
    )


def _build_related_news_cache_key(request: RelatedNewsRequest) -> str:
    payload = {
        "version": RELATED_NEWS_CACHE_VERSION,
        "assetNames": _normalize_cache_values(request.assetNames),
        "candidateQueries": _normalize_cache_values(request.candidateQueries),
        "goalType": request.goalType.value if request.goalType else None,
        "limitPerKeyword": request.limitPerKeyword,
        "riskProfile": request.riskProfile.value if request.riskProfile else None,
        "tickers": _normalize_cache_values(request.tickers),
    }
    return json.dumps(payload, ensure_ascii=False, sort_keys=True)


def _normalize_cache_values(values: list[str]) -> list[str]:
    return sorted({value.strip() for value in values if value and value.strip()})


def _read_related_news_cache(cache_key: str) -> RelatedNewsResponse | None:
    cached_item = _RELATED_NEWS_CACHE.get(cache_key)
    if not cached_item:
        return None

    cached_at, ttl_seconds, response = cached_item
    if time.time() - cached_at > ttl_seconds:
        _RELATED_NEWS_CACHE.pop(cache_key, None)
        return None

    return response


def _write_related_news_cache(cache_key: str, response: RelatedNewsResponse) -> None:
    _prune_expired_related_news_cache()
    if cache_key not in _RELATED_NEWS_CACHE and len(_RELATED_NEWS_CACHE) >= RELATED_NEWS_CACHE_MAX_ENTRIES:
        oldest_key = min(_RELATED_NEWS_CACHE, key=lambda key: _RELATED_NEWS_CACHE[key][0])
        _RELATED_NEWS_CACHE.pop(oldest_key, None)

    ttl_seconds = (
        RELATED_NEWS_FAILURE_CACHE_TTL_SECONDS
        if response.digestStatus.status == "failed" or not response.articles
        else RELATED_NEWS_CACHE_TTL_SECONDS
    )
    _RELATED_NEWS_CACHE[cache_key] = (time.time(), ttl_seconds, response)


def _prune_expired_related_news_cache() -> None:
    now = time.time()
    expired_keys = [
        cache_key
        for cache_key, (cached_at, ttl_seconds, _response) in _RELATED_NEWS_CACHE.items()
        if now - cached_at > ttl_seconds
    ]
    for cache_key in expired_keys:
        _RELATED_NEWS_CACHE.pop(cache_key, None)


def _build_news_keywords(request: RelatedNewsRequest) -> list[str]:
    keywords = []
    seen_keywords = set()

    def add_keyword(value: str | None) -> None:
        keyword = (value or "").strip()
        if keyword and keyword not in seen_keywords:
            seen_keywords.add(keyword)
            keywords.append(keyword)

    added_names = 0
    for name in request.assetNames:
        before_count = len(keywords)
        add_keyword(name)
        if len(keywords) > before_count:
            added_names += 1
        if added_names >= NEWS_MAX_HOLDING_NAMES:
            break

    has_asset_names = added_names > 0
    added_tickers = 0
    for ticker in request.tickers:
        ticker_keyword = _get_ticker_news_keyword(ticker)
        if has_asset_names and _is_market_symbol(ticker_keyword):
            continue

        before_count = len(keywords)
        add_keyword(ticker_keyword)
        if len(keywords) > before_count:
            added_tickers += 1
        if added_tickers >= NEWS_MAX_HOLDING_TICKERS:
            break

    added_candidates = 0
    for query in request.candidateQueries:
        before_count = len(keywords)
        add_keyword(query)
        if len(keywords) > before_count:
            added_candidates += 1
        if added_candidates >= NEWS_MAX_CANDIDATE_QUERIES:
            break

    if request.goalType:
        goal_keyword = {
            "jeonse": "전세자금 투자",
            "seed": "목돈 마련 투자",
            "car": "자동차 구매 자금",
            "wedding": "결혼자금 투자",
            "other": "재무 목표 투자",
        }[request.goalType.value]
        add_keyword(goal_keyword)

    if request.riskProfile:
        risk_keyword = {
            "stable": "안정형 ETF",
            "neutral": "중립형 포트폴리오",
            "aggressive": "성장형 ETF",
        }[request.riskProfile.value]
        add_keyword(risk_keyword)

    return keywords


def _build_holding_news_keywords(request: RelatedNewsRequest) -> set[str]:
    return {
        keyword.strip()
        for keyword in [*[_get_ticker_news_keyword(ticker) for ticker in request.tickers], *request.assetNames]
        if keyword and keyword.strip()
    }


def _get_ticker_news_keyword(ticker: str) -> str:
    normalized = ticker.strip()
    return TICKER_KEYWORDS.get(normalized, normalized)


def _is_market_symbol(value: str) -> bool:
    return bool(MARKET_SYMBOL_PATTERN.fullmatch(value.strip()))
