"""Authentication API routes."""

import hashlib
import hmac
import base64
import time
import json
import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

router = APIRouter()

# Path to user secrets file
_SECRETS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "projects", "user_secrets.json")

# Secret key for token signing (hardcoded for simplicity — could be env var)
_TOKEN_SECRET = "script_platform_secret_key_2026"


def _load_users() -> list:
    """Load users from the secrets file."""
    if not os.path.exists(_SECRETS_PATH):
        return []
    with open(_SECRETS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("users", [])


def _find_user(username: str) -> Optional[dict]:
    """Find a user by username."""
    for u in _load_users():
        if u["username"] == username:
            return u
    return None


def _generate_token(username: str) -> str:
    """Generate a signed token for a username."""
    timestamp = str(int(time.time()))
    payload = f"{username}:{timestamp}"
    signature = hmac.new(
        _TOKEN_SECRET.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    token_raw = f"{username}:{timestamp}:{signature}"
    return base64.urlsafe_b64encode(token_raw.encode("utf-8")).decode("utf-8")


def _verify_token(token: str) -> Optional[str]:
    """Verify a token and return the username if valid."""
    try:
        raw = base64.urlsafe_b64decode(token.encode("utf-8")).decode("utf-8")
        parts = raw.split(":")
        if len(parts) != 3:
            return None
        username, timestamp_str, signature = parts

        # Verify signature
        payload = f"{username}:{timestamp_str}"
        expected_sig = hmac.new(
            _TOKEN_SECRET.encode("utf-8"),
            payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(signature, expected_sig):
            return None

        # Optional: check token age (max 7 days)
        token_time = int(timestamp_str)
        if time.time() - token_time > 7 * 24 * 3600:
            return None

        # Verify user exists
        user = _find_user(username)
        if user is None:
            return None

        return username
    except Exception:
        return None


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    username: str
    displayName: str


class UserInfoResponse(BaseModel):
    username: str
    displayName: str


# --- Dependency: Extract user from Authorization header ---

security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    """FastAPI dependency: extract and validate the current user from the Authorization header."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="请先登录")

    username = _verify_token(credentials.credentials)
    if username is None:
        raise HTTPException(status_code=401, detail="登录已过期或无效，请重新登录")
    return username


# --- Routes ---

@router.post("/auth/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    """Authenticate user with username and password. Returns a token."""
    user = _find_user(body.username)
    if user is None or user["password"] != body.password:
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    token = _generate_token(body.username)
    return LoginResponse(
        token=token,
        username=body.username,
        displayName=user.get("displayName", body.username),
    )


@router.get("/auth/me", response_model=UserInfoResponse)
async def get_me(username: str = Depends(get_current_user)):
    """Get current user info from token."""
    user = _find_user(username)
    return UserInfoResponse(
        username=username,
        displayName=user.get("displayName", username) if user else username,
    )
