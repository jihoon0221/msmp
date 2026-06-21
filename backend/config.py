import os
from pathlib import Path

from dotenv import load_dotenv


load_dotenv(Path(__file__).with_name(".env"))


def is_env_set(name: str) -> bool:
    return bool(os.getenv(name))


def get_backend_service_status() -> dict[str, bool]:
    return {
        "portfolioRecommendation": True,
        "assetValuation": True,
        "naverNews": is_env_set("NAVER_CLIENT_ID") and is_env_set("NAVER_CLIENT_SECRET"),
        "geminiDigest": is_env_set("GEMINI_API_KEY"),
    }
