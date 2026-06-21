import logging

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from asset_valuation_service import evaluate_asset_portfolio
from auth import require_authenticated_user
from config import get_allowed_origins, get_backend_service_status
from news_service import NewsServiceError, get_related_news_v1
from portfolio_ai_service import generate_portfolio_recommendation
from schemas import (
    AssetValuationRequest,
    AssetValuationResponse,
    BackendHealthResponse,
    PortfolioRecommendationRequest,
    PortfolioRecommendationResponse,
    RelatedNewsRequest,
    RelatedNewsResponse,
)

logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health", response_model=BackendHealthResponse)
def health_check():
    return BackendHealthResponse(status="ok", services=get_backend_service_status())


@app.post(
    "/api/v1/portfolio/recommendations",
    response_model=PortfolioRecommendationResponse,
    dependencies=[Depends(require_authenticated_user)],
)
def create_portfolio_recommendation(request: PortfolioRecommendationRequest):
    return generate_portfolio_recommendation(request)


@app.post(
    "/api/v1/assets/valuation",
    response_model=AssetValuationResponse,
    dependencies=[Depends(require_authenticated_user)],
)
def create_asset_valuation(request: AssetValuationRequest):
    try:
        return evaluate_asset_portfolio(request)
    except Exception as exc:
        logger.exception("Asset valuation failed")
        raise HTTPException(
            status_code=500,
            detail=f"자산 평가 계산에 실패했습니다. ({type(exc).__name__})",
        ) from exc


@app.post(
    "/api/v1/news/related",
    response_model=RelatedNewsResponse,
    dependencies=[Depends(require_authenticated_user)],
)
def related_news_v1(request: RelatedNewsRequest):
    if (
        not request.tickers
        and not request.assetNames
        and not request.candidateQueries
        and not request.goalType
        and not request.riskProfile
    ):
        raise HTTPException(status_code=400, detail="검색 조건이 필요합니다.")

    try:
        return get_related_news_v1(request)
    except NewsServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
