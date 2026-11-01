from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.dependencies import CurrentAdmin, DbSession, ResourceId, require_admin
from app.models import User
from app.schemas import UserOut, UserStatusUpdate

router = APIRouter(
    prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)]
)


@router.get("/users")
def list_users(db: DbSession) -> list[UserOut]:
    users = db.scalars(select(User).order_by(User.id))
    return [UserOut.model_validate(user) for user in users]


@router.patch("/users/{user_id}")
def update_user_status(
    user_id: ResourceId, body: UserStatusUpdate, admin: CurrentAdmin, db: DbSession
) -> UserOut:
    if user_id == admin.id and not body.is_active:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "You can't deactivate your own account"
        )
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    user.is_active = body.is_active
    db.commit()
    return UserOut.model_validate(user)
