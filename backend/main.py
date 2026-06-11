from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from news_service import NewsServiceError, get_related_news

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/news/related")
def related_news(tickers: str):
    ticker_list = [ticker.strip() for ticker in tickers.split(",") if ticker.strip()]
    try:
        return get_related_news(ticker_list)
    except NewsServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
