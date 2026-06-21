import os
from pathlib import Path

from dotenv import load_dotenv


load_dotenv(Path(__file__).with_name(".env"))


def is_env_set(name: str) -> bool:
    return bool(os.getenv(name))


def get_allowed_origins() -> list[str]:
    raw_value = os.getenv("API_ALLOWED_ORIGINS", "")
    origins = [origin.strip() for origin in raw_value.split(",") if origin.strip()]
    return origins or [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


def get_backend_service_status() -> dict[str, bool]:
    has_supabase_auth_config = (is_env_set("SUPABASE_URL") or is_env_set("VITE_SUPABASE_URL")) and (
        is_env_set("SUPABASE_PUBLISHABLE_KEY")
        or is_env_set("SUPABASE_ANON_KEY")
        or is_env_set("VITE_SUPABASE_ANON_KEY")
    )
    return {
        "portfolioRecommendation": True,
        "assetValuation": True,
        "authGuard": is_env_set("SUPABASE_JWT_SECRET") or has_supabase_auth_config,
        "supabaseAuthServer": has_supabase_auth_config,
        "naverNews": is_env_set("NAVER_CLIENT_ID") and is_env_set("NAVER_CLIENT_SECRET"),
        "geminiDigest": is_env_set("GEMINI_API_KEY"),
    }
