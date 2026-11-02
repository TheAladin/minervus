from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.dependencies import DbSession, OwnedCard, OwnedDeck
from app.models import Card
from app.schemas import CardOut, ReviewCreate
from app.srs import Schedule, next_schedule

router = APIRouter(prefix="/api/decks", tags=["study"])


@router.get("/{deck_id}/due")
def list_due_cards(deck: OwnedDeck, db: DbSession) -> list[CardOut]:
    cards = db.scalars(
        select(Card)
        .where(Card.deck_id == deck.id, Card.due_at <= func.now())
        .order_by(Card.due_at, Card.id)
    )
    return [CardOut.model_validate(card) for card in cards]


@router.post("/{deck_id}/cards/{card_id}/review")
def review_card(body: ReviewCreate, card: OwnedCard, db: DbSession) -> CardOut:
    # The lock and the due check stop a double submit from advancing the card twice.
    # Again leaves the card due, so a repeat of that rating still counts as a review.
    db.refresh(card, with_for_update=True)
    now: datetime = db.scalar(select(func.now()))
    if card.due_at > now:
        raise HTTPException(status.HTTP_409_CONFLICT, "This card isn't due yet")

    schedule = next_schedule(
        Schedule(card.interval_days, card.ease, card.repetitions), body.rating
    )
    card.interval_days = schedule.interval_days
    card.ease = schedule.ease
    card.repetitions = schedule.repetitions
    card.due_at = now + timedelta(days=schedule.interval_days)
    db.commit()
    return CardOut.model_validate(card)
