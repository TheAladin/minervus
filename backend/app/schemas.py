from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field

from app.models import Role

Email = Annotated[EmailStr, AfterValidator(str.lower)]
NewPassword = Annotated[str, Field(min_length=8, max_length=128)]


class Credentials(BaseModel):
    email: Email
    password: str = Field(max_length=128)


class Registration(Credentials):
    password: NewPassword


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    role: Role
    is_active: bool
    created_at: datetime


class UserStatusUpdate(BaseModel):
    is_active: bool
