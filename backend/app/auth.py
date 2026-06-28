"""Simple shared-password gate using a signed cookie.

If APP_PASSWORD is unset (AUTH_ENABLED is False) the gate is a no-op, which is
convenient for local development. On Railway, set APP_PASSWORD to lock it down.
"""
from fastapi import Cookie, HTTPException, Response, status
from itsdangerous import BadSignature, URLSafeSerializer

from .config import APP_PASSWORD, AUTH_ENABLED, SECRET_KEY

COOKIE_NAME = "office_heat_auth"
_serializer = URLSafeSerializer(SECRET_KEY, salt="auth")


def make_cookie_value() -> str:
    return _serializer.dumps({"ok": True})


def set_auth_cookie(response: Response) -> None:
    response.set_cookie(
        COOKIE_NAME,
        make_cookie_value(),
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 90,  # 90 days
        secure=False,  # Railway terminates TLS at the edge; cookie still flows over https
    )


def check_password(candidate: str) -> bool:
    return AUTH_ENABLED and candidate == APP_PASSWORD


def require_auth(office_heat_auth: str | None = Cookie(default=None)):
    """FastAPI dependency. Raises 401 unless authed (or auth disabled)."""
    if not AUTH_ENABLED:
        return True
    if not office_heat_auth:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Login required")
    try:
        data = _serializer.loads(office_heat_auth)
    except BadSignature:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid session")
    if not data.get("ok"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Login required")
    return True
