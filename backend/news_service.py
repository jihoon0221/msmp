import html
import json
import logging
import os
import re
import time
from datetime import UTC, datetime
from uuid import uuid4

import requests
from schemas import RelatedNewsArticle, RelatedNewsDigestStatus, RelatedNewsRequest, RelatedNewsResponse


logger = logging.getLogger(__name__)
NAVER_NEWS_API_URL = "https://openapi.naver.com/v1/search/news.json"
GEMINI_GENERATE_CONTENT_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
RELATED_NEWS_CACHE_TTL_SECONDS = 2 * 60 * 60
RELATED_NEWS_FAILURE_CACHE_TTL_SECONDS = 10 * 60
RELATED_NEWS_CACHE_MAX_ENTRIES = 64
RELATED_NEWS_CACHE_VERSION = 4
NEWS_MAX_HOLDING_TICKERS = 4
NEWS_MAX_HOLDING_NAMES = 4
NEWS_MAX_CANDIDATE_QUERIES = 3
GEMINI_DIGEST_TIMEOUT_SECONDS = 15
GEMINI_DIGEST_MAX_OUTPUT_TOKENS = 512
DIGEST_MAX_GROUPS = 8
DIGEST_MAX_ARTICLES_PER_GROUP = 1
DIGEST_TITLE_MAX_LENGTH = 100
DIGEST_SUMMARY_MAX_LENGTH = 140
FALLBACK_DIGEST_MAX_LENGTH = 24
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

    response = RelatedNewsResponse(articles=articles, digestSummary=digest_summary, digestStatus=digest_status)
    _write_related_news_cache(cache_key, response)
    return response


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
                    "maxOutputTokens": GEMINI_DIGEST_MAX_OUTPUT_TOKENS,
                    "responseMimeType": "application/json",
                },
            },
            timeout=GEMINI_DIGEST_TIMEOUT_SECONDS,
        )
        if not response.ok:
            return [], RelatedNewsDigestStatus(
                status="failed",
                reason=_format_gemini_http_error(response),
            )

        data = response.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        digest_summary = _parse_digest_summary(text)

        if not digest_summary:
            return _build_digest_fallback(
                grouped_articles,
                "Gemini 응답에서 유효한 요약을 찾지 못해 기사 제목 기반 요약을 표시합니다.",
            )

        return digest_summary, RelatedNewsDigestStatus(status="success")
    except requests.Timeout as exc:
        logger.warning("Gemini digest generation timed out", exc_info=True)
        return _build_digest_fallback(
            grouped_articles,
            "Gemini 요청 시간이 초과되어 기사 제목 기반 요약을 표시합니다.",
        )
    except requests.RequestException as exc:
        logger.warning("Gemini digest generation request failed", exc_info=True)
        return [], RelatedNewsDigestStatus(
            status="failed",
            reason=f"Gemini API 연결에 실패했습니다. ({type(exc).__name__})",
        )
    except json.JSONDecodeError as exc:
        logger.warning("Gemini digest response was not valid JSON", exc_info=True)
        return _build_digest_fallback(
            grouped_articles,
            "Gemini 응답이 JSON 형식이 아니어서 기사 제목 기반 요약을 표시합니다.",
        )
    except (KeyError, TypeError, ValueError) as exc:
        logger.warning("Gemini digest response shape was unexpected", exc_info=True)
        return _build_digest_fallback(
            grouped_articles,
            f"Gemini 응답 구조가 예상과 달라 기사 제목 기반 요약을 표시합니다. ({type(exc).__name__})",
        )


def _build_digest_prompt(grouped_articles: dict[str, list[dict]]) -> str:
    sections = []
    for ticker, articles in list(grouped_articles.items())[:DIGEST_MAX_GROUPS]:
        article_lines = []
        for article in articles[:DIGEST_MAX_ARTICLES_PER_GROUP]:
            title = _truncate_prompt_text(article.get("title", ""), DIGEST_TITLE_MAX_LENGTH)
            summary = _truncate_prompt_text(article.get("summary", ""), DIGEST_SUMMARY_MAX_LENGTH)
            article_lines.append(f"- 제목: {title}\n  요약: {summary}")
        sections.append(f"종목: {ticker}\n" + "\n".join(article_lines))

    return (
        "아래 뉴스들을 종목별로 요약해라.\n"
        "각 종목당 20자 이내 한국어 한 줄 요약을 JSON 배열로만 응답해라.\n"
        "설명, 마크다운 코드블록은 포함하지 마라.\n"
        '응답 형식: [{"ticker": "삼성전자", "summary": "..."}]\n\n'
        + "\n\n".join(sections)
    )


def _truncate_prompt_text(value: str, max_length: int) -> str:
    normalized = " ".join(str(value or "").split())
    if len(normalized) <= max_length:
        return normalized
    return normalized[:max_length].rstrip() + "..."


def _build_digest_fallback(
    grouped_articles: dict[str, list[dict]],
    reason: str,
) -> tuple[list[dict], RelatedNewsDigestStatus]:
    digest_summary = []

    for ticker, articles in list(grouped_articles.items())[:DIGEST_MAX_GROUPS]:
        if not articles:
            continue
        summary = _build_fallback_digest_text(articles[0])
        if summary:
            digest_summary.append({"ticker": ticker, "summary": summary})

    if digest_summary:
        return digest_summary, RelatedNewsDigestStatus(status="skipped", reason=reason)

    return [], RelatedNewsDigestStatus(status="failed", reason=reason)


def _build_fallback_digest_text(article: dict) -> str:
    text = _truncate_display_text(
        article.get("summary") or article.get("title") or "",
        FALLBACK_DIGEST_MAX_LENGTH,
    )
    return text or "관련 기사 확인 필요"


def _truncate_display_text(value: str, max_length: int) -> str:
    text = _clean_display_text(value)
    if len(text) <= max_length:
        return text

    truncated = text[:max_length].rstrip()
    boundary = truncated.rfind(" ")
    if boundary >= max_length * 0.6:
        truncated = truncated[:boundary].rstrip()

    return re.sub(r"\s?[A-Za-z0-9]{1,4}$", "", truncated).rstrip() or text[:max_length].rstrip()


def _clean_display_text(value: str) -> str:
    text = " ".join(str(value or "").split())
    text = re.sub(r"(\.{2,}|…)+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip(" -·,")


def _parse_digest_summary(value: str) -> list[dict]:
    parsed = _parse_gemini_json(value)
    items = _normalize_digest_items(parsed)
    digest_summary = []

    for item in items:
        if not isinstance(item, dict):
            continue
        ticker = str(item.get("ticker") or item.get("symbol") or item.get("name") or "").strip()
        summary = str(item.get("summary") or item.get("text") or item.get("headline") or item.get("요약") or "").strip()
        if ticker and summary:
            digest_summary.append({"ticker": ticker, "summary": summary[:60]})

    return digest_summary


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


def _normalize_digest_items(parsed) -> list:
    if isinstance(parsed, list):
        return parsed

    if isinstance(parsed, dict):
        has_single_ticker = any(key in parsed for key in ["ticker", "symbol", "name"])
        has_single_summary = any(key in parsed for key in ["summary", "text", "headline", "요약"])
        if has_single_ticker and has_single_summary:
            return [parsed]

        for key in ["items", "summaries", "digestSummary", "data", "result"]:
            value = parsed.get(key)
            if isinstance(value, list):
                return value

        if all(isinstance(value, str) for value in parsed.values()):
            return [{"ticker": key, "summary": value} for key, value in parsed.items()]

    return []


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

    if detail:
        return f"Gemini API 오류 {response.status_code}: {detail}"

    return f"Gemini API 오류 {response.status_code}: 응답 본문이 비어 있습니다."


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
