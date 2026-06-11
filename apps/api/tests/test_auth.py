"""Tests for the no-auth preview identity fallback in require_authenticated_user.

The fallback lets the token-less ``web-noauth`` preview resolve to the Playwright
test profile, but ONLY in the dedicated preview mode (``APPLYWISE_API_ENV=preview``).
Token-bearing requests (real browsers, the E2E suite) and the ``development`` /
``production`` environments are never affected.
"""

import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app import auth
from app.auth import AuthenticatedUser, require_authenticated_user


def _settings(*, api_env: str = "preview", preview_clerk_user_id: str = ""):
    return SimpleNamespace(api_env=api_env, preview_clerk_user_id=preview_clerk_user_id)


def _tokenless_request() -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [],
            "query_string": b"",
        }
    )


def test_preview_user_none_without_configured_id(monkeypatch):
    monkeypatch.setattr(auth, "get_settings", _settings)
    assert auth._preview_user() is None


def test_preview_user_returns_configured_id_in_preview_mode(monkeypatch):
    monkeypatch.setattr(
        auth, "get_settings", lambda: _settings(preview_clerk_user_id="user_preview")
    )
    assert auth._preview_user() == AuthenticatedUser(clerk_user_id="user_preview")


def test_preview_user_disabled_in_development(monkeypatch):
    # The default env for normal dev AND the test suite — must never bypass auth.
    monkeypatch.setattr(
        auth,
        "get_settings",
        lambda: _settings(api_env="development", preview_clerk_user_id="user_preview"),
    )
    assert auth._preview_user() is None


def test_preview_user_disabled_in_production(monkeypatch):
    monkeypatch.setattr(
        auth,
        "get_settings",
        lambda: _settings(api_env="production", preview_clerk_user_id="user_preview"),
    )
    assert auth._preview_user() is None


def test_tokenless_request_resolves_to_preview_user(monkeypatch):
    monkeypatch.setattr(
        auth, "get_settings", lambda: _settings(preview_clerk_user_id="user_preview")
    )
    user = asyncio.run(require_authenticated_user(_tokenless_request()))
    assert user == AuthenticatedUser(clerk_user_id="user_preview")


def test_tokenless_request_unauthorized_in_development(monkeypatch):
    monkeypatch.setattr(
        auth,
        "get_settings",
        lambda: _settings(api_env="development", preview_clerk_user_id="user_preview"),
    )
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(require_authenticated_user(_tokenless_request()))
    assert exc_info.value.status_code == 401
