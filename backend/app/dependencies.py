from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Role, User
from app.security import read_session_token

SESSION_COOKIE = "minervus_session"
POSTGRES_INTEGER_MAX = 2**31 - 1

DbSession = Annotated[Session, Depends(get_db)]
ResourceId = Annotated[int, Path(ge=1, le=POSTGRES_INTEGER_MAX)]


def get_current_user(
    db: DbSession,
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> User:
    user_id = read_session_token(session_token) if session_token else None
    user = db.get(User, user_id) if user_id is not None else None
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_admin(user: CurrentUser) -> User:
    if user.role is not Role.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return user


CurrentAdmin = Annotated[User, Depends(require_admin)]
