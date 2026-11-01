from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from app.config import settings

JWT_ALGORITHM = "HS256"
SESSION_LIFETIME = timedelta(days=7)

_hasher = PasswordHash.recommended()
_dummy_hash = _hasher.hash("not-a-real-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if password_hash is None:
        # Takes as long as a real check, so timing can't reveal which emails exist.
        _hasher.verify(password, _dummy_hash)
        return False
    return _hasher.verify(password, password_hash)


def create_session_token(user_id: int) -> str:
    now = datetime.now(UTC)
    claims = {"sub": str(user_id), "iat": now, "exp": now + SESSION_LIFETIME}
    return jwt.encode(claims, settings.jwt_secret, algorithm=JWT_ALGORITHM)


def read_session_token(token: str) -> int | None:
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp"]},
        )
    except jwt.InvalidTokenError:
        return None
    return int(claims["sub"])
