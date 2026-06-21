import base64
import binascii
import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass

import requests
from fastapi import HTTPException, Request, status


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str
    email: str | None = None


def require_authenticated_user(request: Request) -> AuthenticatedUser:
    token = _get_bearer_token(request)
    payload = _verify_supabase_jwt(token)
    user_id = str(payload.get("sub") or "").strip()
    role = str(payload.get("role") or "").strip()

    if not user_id or role != "authenticated":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증된 사용자 토큰이 필요합니다.",
        )

    email = payload.get("email")
    return AuthenticatedUser(user_id=user_id, email=str(email) if email else None)


def _get_bearer_token(request: Request) -> str:
    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization Bearer 토큰이 필요합니다.",
        )
    return token


def _verify_supabase_jwt(token: str) -> dict:
    try:
        header_segment, payload_segment, signature_segment = token.split(".")
        header = _decode_json_segment(header_segment)
        payload = _decode_json_segment(payload_segment)
    except (ValueError, json.JSONDecodeError, binascii.Error, UnicodeDecodeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰 형식이 올바르지 않습니다.",
        ) from None

    if header.get("alg") == "HS256" and os.getenv("SUPABASE_JWT_SECRET"):
        _verify_hs256_signature(header_segment, payload_segment, signature_segment)
    else:
        _verify_with_supabase_auth_server(token)

    _validate_standard_claims(payload)
    return payload


def _verify_hs256_signature(header_segment: str, payload_segment: str, signature_segment: str) -> None:
    secret = os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SUPABASE_JWT_SECRET이 설정되지 않았습니다.",
        )

    try:
        signature = _decode_segment(signature_segment)
    except binascii.Error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰 형식이 올바르지 않습니다.",
        ) from None

    signed_value = f"{header_segment}.{payload_segment}".encode()
    expected_signature = hmac.new(secret.encode(), signed_value, hashlib.sha256).digest()
    if not hmac.compare_digest(signature, expected_signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰 서명이 올바르지 않습니다.",
        )


def _verify_with_supabase_auth_server(token: str) -> None:
    supabase_url = (os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or "").rstrip("/")
    publishable_key = (
        os.getenv("SUPABASE_PUBLISHABLE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("VITE_SUPABASE_ANON_KEY")
    )
    if not supabase_url or not publishable_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SUPABASE_URL과 SUPABASE_PUBLISHABLE_KEY가 필요합니다.",
        )

    try:
        response = requests.get(
            f"{supabase_url}/auth/v1/user",
            headers={
                "apikey": publishable_key,
                "Authorization": f"Bearer {token}",
            },
            timeout=5,
        )
    except requests.RequestException:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase Auth 서버에서 토큰을 확인하지 못했습니다.",
        ) from None

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Supabase Auth 토큰 검증에 실패했습니다.",
        )


def _validate_standard_claims(payload: dict) -> None:
    now = int(time.time())
    expires_at = _read_timestamp(payload, "exp")
    not_before = _read_optional_timestamp(payload, "nbf")
    if expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰이 만료되었습니다.",
        )
    if not_before is not None and not_before > now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아직 유효하지 않은 토큰입니다.",
        )

    audience = payload.get("aud")
    if audience and not _has_audience(audience, "authenticated"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰 audience가 올바르지 않습니다.",
        )


def _decode_json_segment(segment: str) -> dict:
    return json.loads(_decode_segment(segment))


def _decode_segment(segment: str) -> bytes:
    padded = segment + "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(padded.encode())


def _read_timestamp(payload: dict, key: str) -> int:
    try:
        return int(payload.get(key) or 0)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰 시간이 올바르지 않습니다.",
        ) from None


def _read_optional_timestamp(payload: dict, key: str) -> int | None:
    value = payload.get(key)
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰 시간이 올바르지 않습니다.",
        ) from None


def _has_audience(audience, expected: str) -> bool:
    if isinstance(audience, str):
        return audience == expected
    if isinstance(audience, list):
        return expected in audience
    return False
