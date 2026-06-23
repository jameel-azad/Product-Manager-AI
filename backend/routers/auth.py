"""
Xccelera AI-SDLC Platform — Authentication Router.

Handles registration, login, token refresh, logout, and user/org management.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Organization, RefreshToken, User
from schemas import (
    LoginRequest,
    MessageResponse,
    OrgResponse,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from auth import (
    REFRESH_TOKEN_EXPIRE_DAYS,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_DEMO_EMAIL = "demo@xccelera.ai"
_DEMO_PASSWORD = "demo123"
_DEMO_ORG_NAME = "Xccelera Demo"
_DEMO_FULL_NAME = "Demo User"


async def _issue_tokens(user: User, db: AsyncSession) -> TokenResponse:
    """Create access + refresh tokens, persist the refresh token, return response."""
    access_token = create_access_token({"sub": user.id, "org_id": user.org_id})
    refresh_token_str = create_refresh_token({"sub": user.id, "org_id": user.org_id})

    expires_at = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    db_refresh = RefreshToken(
        user_id=user.id,
        token=refresh_token_str,
        expires_at=expires_at,
    )
    db.add(db_refresh)
    await db.flush()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token_str,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


async def _get_or_create_demo_user(db: AsyncSession) -> User:
    """Return existing demo user or create a fresh org + user for the demo account."""
    result = await db.execute(select(User).where(User.email == _DEMO_EMAIL))
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    # Create demo organisation
    slug = _DEMO_ORG_NAME.lower().replace(" ", "-")
    org = Organization(name=_DEMO_ORG_NAME, slug=slug)
    db.add(org)
    await db.flush()

    user = User(
        org_id=org.id,
        email=_DEMO_EMAIL,
        full_name=_DEMO_FULL_NAME,
        password_hash=hash_password(_DEMO_PASSWORD),
        role="project_manager",
    )
    db.add(user)
    await db.flush()
    return user


# ---------------------------------------------------------------------------
# 1. POST /auth/register
# ---------------------------------------------------------------------------


class _UserUpdateRequest:
    """Inline request body for PUT /users/{user_id}."""
    def __init__(self, full_name: Optional[str] = None, role: Optional[str] = None):
        self.full_name = full_name
        self.role = role


from pydantic import BaseModel  # noqa: E402 — local import after stdlib


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new organisation and admin user",
)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """
    Create a new Organisation and a Project-Manager admin user, then return
    a JWT token pair so the caller is immediately authenticated.
    """
    # Reject duplicate email within any org (for demo simplicity we search globally)
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email already exists.",
        )

    # Create organisation
    slug = body.org_name.lower().replace(" ", "-")

    # Ensure unique slug
    existing_org = await db.execute(
        select(Organization).where(Organization.slug == slug)
    )
    if existing_org.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An organisation with that name already exists.",
        )

    org = Organization(name=body.org_name, slug=slug)
    db.add(org)
    await db.flush()  # populate org.id

    # Create admin user
    user = User(
        org_id=org.id,
        email=body.email,
        full_name=body.full_name,
        password_hash=hash_password(body.password),
        role="project_manager",
    )
    db.add(user)
    await db.flush()  # populate user.id

    return await _issue_tokens(user, db)


# ---------------------------------------------------------------------------
# 2. POST /auth/login
# ---------------------------------------------------------------------------


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate with email and password",
)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """
    Verify credentials and return a JWT token pair.

    Demo fallback: if ``demo@xccelera.ai`` / ``demo123`` is supplied and no
    matching user record exists yet, the demo org and user are auto-created.
    """
    result = await db.execute(select(User).where(User.email == body.email))
    user: Optional[User] = result.scalar_one_or_none()

    # Normal authentication path
    if user is not None:
        if not verify_password(body.password, user.password_hash):
            # Demo fallback check even when user exists (wrong password)
            if body.email == _DEMO_EMAIL and body.password == _DEMO_PASSWORD:
                pass  # fall through to demo block below — user will be reused
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password.",
                )
        # Update last login timestamp
        user.last_login_at = datetime.utcnow()
        return await _issue_tokens(user, db)

    # Demo auto-create fallback
    if body.email == _DEMO_EMAIL and body.password == _DEMO_PASSWORD:
        user = await _get_or_create_demo_user(db)
        user.last_login_at = datetime.utcnow()
        return await _issue_tokens(user, db)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password.",
    )


# ---------------------------------------------------------------------------
# 3. POST /auth/logout
# ---------------------------------------------------------------------------


class _RefreshBody(BaseModel):
    refresh_token: str


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Invalidate a refresh token",
)
async def logout(body: _RefreshBody, db: AsyncSession = Depends(get_db)) -> MessageResponse:
    """Delete the supplied refresh token from the database."""
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token == body.refresh_token)
    )
    db_token = result.scalar_one_or_none()
    if db_token:
        await db.delete(db_token)

    return MessageResponse(message="Logged out successfully.")


# ---------------------------------------------------------------------------
# 4. POST /auth/refresh
# ---------------------------------------------------------------------------


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Exchange a refresh token for a new access token",
)
async def refresh_token(
    body: _RefreshBody, db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    """
    Validate the supplied refresh token, rotate it (delete old, issue new),
    and return a fresh token pair.
    """
    _credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Verify JWT signature / expiry
    payload = decode_token(body.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise _credentials_error

    # Look up in DB (ensures it has not been explicitly invalidated)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token == body.refresh_token)
    )
    db_token = result.scalar_one_or_none()
    if db_token is None:
        raise _credentials_error

    # Check DB-level expiry as an extra safety net
    if db_token.expires_at < datetime.utcnow():
        await db.delete(db_token)
        raise _credentials_error

    # Load the associated user
    user_id: Optional[str] = payload.get("sub")
    user_result = await db.execute(select(User).where(User.id == user_id))
    user: Optional[User] = user_result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise _credentials_error

    # Rotate: delete old token before issuing new one
    await db.delete(db_token)
    await db.flush()

    return await _issue_tokens(user, db)


# ---------------------------------------------------------------------------
# 5. GET /auth/me
# ---------------------------------------------------------------------------


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Return the currently authenticated user",
)
async def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)


# ---------------------------------------------------------------------------
# 6. GET /auth/users
# ---------------------------------------------------------------------------


@router.get(
    "/users",
    response_model=List[UserResponse],
    summary="List all users in the authenticated user's organisation",
)
async def list_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[UserResponse]:
    result = await db.execute(
        select(User).where(User.org_id == current_user.org_id).order_by(User.created_at)
    )
    users = result.scalars().all()
    return [UserResponse.model_validate(u) for u in users]


# ---------------------------------------------------------------------------
# 7. PUT /auth/users/{user_id}
# ---------------------------------------------------------------------------


@router.put(
    "/users/{user_id}",
    response_model=UserResponse,
    summary="Update a user's role or display name",
)
async def update_user(
    user_id: str,
    body: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """
    Only users within the same organisation may be updated.
    Callers may update their own record; updating another user's record
    requires the ``project_manager`` or ``admin`` role.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    target: Optional[User] = result.scalar_one_or_none()

    if target is None or target.org_id != current_user.org_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    # Non-managers may only update themselves
    if target.id != current_user.id and current_user.role not in (
        "project_manager",
        "admin",
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update other users.",
        )

    if body.full_name is not None:
        target.full_name = body.full_name
    if body.role is not None:
        target.role = body.role

    await db.flush()
    return UserResponse.model_validate(target)


# ---------------------------------------------------------------------------
# 8. GET /auth/organizations
# ---------------------------------------------------------------------------


@router.get(
    "/organizations",
    response_model=List[OrgResponse],
    summary="List all organisations (admin / project_manager only)",
)
async def list_organizations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[OrgResponse]:
    """
    Returns all organisations.  Restricted to users with the
    ``project_manager`` or ``admin`` role.
    """
    if current_user.role not in ("project_manager", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or project_manager role required.",
        )

    result = await db.execute(select(Organization).order_by(Organization.created_at))
    orgs = result.scalars().all()
    return [OrgResponse.model_validate(o) for o in orgs]
