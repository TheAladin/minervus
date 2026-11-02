from datetime import datetime
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
)

from app.models import Role

Email = Annotated[EmailStr, AfterValidator(str.lower)]
NewPassword = Annotated[str, Field(min_length=8, max_length=128)]


def _reject_nul(value: str) -> str:
    # Postgres can't store NUL in text, so it would otherwise cause a 500.
    if "\x00" in value:
        raise ValueError("must not contain NUL characters")
    return value


DeckName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=200),
    AfterValidator(_reject_nul),
]
CardText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=10_000),
    AfterValidator(_reject_nul),
]


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


class DeckWrite(BaseModel):
    name: DeckName


class DeckOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: datetime
    card_count: int


class CardCreate(BaseModel):
    front: CardText
    back: CardText


class CardUpdate(BaseModel):
    front: CardText | None = None
    back: CardText | None = None


class CardBulkCreate(BaseModel):
    cards: list[CardCreate] = Field(min_length=1, max_length=100)


class CardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    deck_id: int
    front: str
    back: str
    created_at: datetime
