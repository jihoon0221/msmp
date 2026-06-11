import html
import os
import re
from pathlib import Path

import requests
from dotenv import load_dotenv


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


def get_related_news(tickers):
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
                    "display": 1,
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

            item = items[0]
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
