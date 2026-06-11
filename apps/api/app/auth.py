from dataclasses import dataclass
from urllib.parse import urlparse

import jwt
from fastapi import HTTPException, Request, status
from jwt import PyJWKClient

from app.settings import get_settings


@dataclass(frozen=True)
class AuthenticatedUser:
    clerk_user_id: str


async def require_authenticated_user(request: Request) -> AuthenticatedUser:
    token = _get_session_token(request)
    if token is None:
        preview_user = _preview_user()
        if preview_user is not None:
            return preview_user
        raise _unauthorized()

    try:
        unverified_claims = jwt.decode(token, options={"verify_signature": False})
        issuer = str(unverified_claims.get("iss") or "")
        jwks_url = _resolve_jwks_url(issuer)
        signing_key = PyJWKClient(jwks_url).get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=issuer,
            options={"require": ["exp", "iss", "sub"], "verify_aud": False},
        )
    except Exception as exc:
        raise _unauthorized() from exc

    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject:
        raise _unauthorized()

    return AuthenticatedUser(clerk_user_id=subject)


def _preview_user() -> AuthenticatedUser | None:
    """No-auth preview identity for token-less requests.

    Active only in the dedicated preview mode (``APPLYWISE_API_ENV=preview``) and
    only when ``APPLYWISE_PREVIEW_CLERK_USER_ID`` is set, so the ``web-noauth``
    preview (which sends no token) resolves to the Playwright test profile and the
    backend serves real, seeded data. Any request that carries a token is verified
    normally, leaving real browsers and the E2E suite untouched; normal dev and the
    test suite run as ``development`` and production as ``production``, so neither
    triggers the bypass.
    """
    settings = get_settings()
    if settings.api_env != "preview":
        return None
    if not settings.preview_clerk_user_id:
        return None
    return AuthenticatedUser(clerk_user_id=settings.preview_clerk_user_id)


def _get_session_token(request: Request) -> str | None:
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() == "bearer" and token:
        return token.strip()

    session_cookie = request.cookies.get("__session")
    if session_cookie:
        return session_cookie

    return None


def _resolve_jwks_url(issuer: str) -> str:
    settings = get_settings()
    if settings.clerk_jwks_url:
        return settings.clerk_jwks_url

    parsed = urlparse(issuer)
    host = parsed.hostname or ""
    if parsed.scheme != "https" or not (
        host == "clerk.accounts.dev"
        or host.endswith(".clerk.accounts.dev")
        or host == "clerk.com"
        or host.endswith(".clerk.com")
    ):
        raise ValueError("Unsupported Clerk issuer.")

    return issuer.rstrip("/") + "/.well-known/jwks.json"


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized",
        headers={"WWW-Authenticate": "Bearer"},
    )
