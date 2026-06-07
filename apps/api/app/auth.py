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
