import os
from pathlib import Path

from dotenv import load_dotenv


load_dotenv(Path(__file__).with_name(".env"))


def is_env_set(name: str) -> bool:
    return bool(os.getenv(name))


def is_any_env_set(names: list[str]) -> bool:
    return any(is_env_set(name) for name in names)


def get_allowed_origins() -> list[str]:
    raw_value = os.getenv("API_ALLOWED_ORIGINS", "")
    origins = [origin.strip() for origin in raw_value.split(",") if origin.strip()]
    return origins or [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


def get_backend_service_status() -> dict[str, bool]:
    has_supabase_url = is_any_env_set([
        "SUPABASE_URL",
        "VITE_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_URL",
        "SUPABASE_PROJECT_URL",
    ])
    has_supabase_publishable_key = is_any_env_set([
        "SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_ANON_KEY",
        "VITE_SUPABASE_ANON_KEY",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_KEY",
    ])
    has_supabase_auth_config = has_supabase_url and has_supabase_publishable_key
    return {
        "portfolioRecommendation": True,
        "assetValuation": True,
        "authGuard": is_env_set("SUPABASE_JWT_SECRET") or has_supabase_auth_config,
        "supabaseAuthServer": has_supabase_auth_config,
        "supabaseAuthUrlConfigured": has_supabase_url,
        "supabaseAuthKeyConfigured": has_supabase_publishable_key,
        "naverNews": is_env_set("NAVER_CLIENT_ID") and is_env_set("NAVER_CLIENT_SECRET"),
        "geminiDigest": is_env_set("GEMINI_API_KEY"),
    }
