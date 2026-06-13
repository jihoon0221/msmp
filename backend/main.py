from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from news_service import NewsServiceError, get_related_news, get_related_news_v1
from portfolio_ai_service import generate_portfolio_recommendation
from schemas import (
    PortfolioRecommendationRequest,
    PortfolioRecommendationResponse,
    RelatedNewsRequest,
    RelatedNewsResponse,
)

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


@app.post(
    "/api/v1/portfolio/recommendations",
    response_model=PortfolioRecommendationResponse,
)
def create_portfolio_recommendation(request: PortfolioRecommendationRequest):
    return generate_portfolio_recommendation(request)


@app.post(
    "/api/v1/news/related",
    response_model=RelatedNewsResponse,
)
def related_news_v1(request: RelatedNewsRequest):
    if not request.tickers and not request.assetNames and not request.goalType and not request.riskProfile:
        raise HTTPException(status_code=400, detail="검색 조건이 필요합니다.")

    try:
        return get_related_news_v1(request)
    except NewsServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
