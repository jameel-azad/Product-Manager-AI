"""
Xccelera AI-SDLC Platform — JWT authentication utilities.

Dependencies:
    pip install python-jose[cryptography] passlib[bcrypt]
"""

import os
from datetime import datetime, timedelta
from typing import Optional

import bcrypt as _bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

JWT_SECRET_KEY: str = os.getenv(
    "JWT_SECRET_KEY", "xccelera-demo-secret-key-change-in-prod"
)
JWT_ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "24"))
REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

_bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    try:
        return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Token creation
# ---------------------------------------------------------------------------


def create_access_token(
    data: dict,
    expires_delta: timedelta = timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
) -> str:
    """
    Create a signed JWT access token.

    Args:
        data: Claims to embed (must include ``sub`` key identifying the user).
        expires_delta: Token lifetime. Defaults to ``ACCESS_TOKEN_EXPIRE_HOURS``.

    Returns:
        Encoded JWT string.
    """
    payload = data.copy()
    expire = datetime.utcnow() + expires_delta
    payload.update({"exp": expire, "type": "access"})
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """
    Create a signed JWT refresh token (7-day lifetime).

    Args:
        data: Claims to embed (must include ``sub`` key).

    Returns:
        Encoded JWT string.
    """
    payload = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload.update({"exp": expire, "type": "refresh"})
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


# ---------------------------------------------------------------------------
# Token decoding
# ---------------------------------------------------------------------------


def decode_token(token: str) -> Optional[dict]:
    """
    Decode and verify a JWT token.

    Returns the claims dict on success, or ``None`` if the token is invalid,
    expired, or tampered.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    FastAPI dependency — resolve the authenticated User from the Bearer token.

    Raises HTTP 401 if:
    - No Authorization header is present.
    - The token is invalid or expired.
    - The user referenced by the token does not exist or is inactive.

    Usage::

        @router.get("/me")
        async def me(user: User = Depends(get_current_user)):
            ...
    """
    # Import here to avoid circular imports at module load time
    from models import User  # noqa: PLC0415

    _unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise _unauthorized

    payload = decode_token(credentials.credentials)
    if payload is None:
        raise _unauthorized

    user_id: Optional[str] = payload.get("sub")
    if user_id is None:
        raise _unauthorized

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise _unauthorized
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is disabled",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    FastAPI dependency — like ``get_current_user`` but returns ``None`` instead
    of raising 401 when no valid token is present.

    Useful for demo or public endpoints that optionally personalise output when
    authenticated.

    Usage::

        @router.get("/public")
        async def public(user = Depends(get_optional_user)):
            if user:
                return {"hello": user.full_name}
            return {"hello": "anonymous"}
    """
    if credentials is None:
        return None

    try:
        return await get_current_user(credentials=credentials, db=db)
    except HTTPException:
        return None
