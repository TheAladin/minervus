from fastapi import APIRouter, status
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.dependencies import CurrentUser, DbSession, OwnedCard, OwnedDeck
from app.models import Card, Deck
from app.schemas import (
    CardBulkCreate,
    CardCreate,
    CardOut,
    CardUpdate,
    DeckOut,
    DeckWrite,
)

router = APIRouter(prefix="/api/decks", tags=["decks"])


def _decks_with_counts() -> Select:
    return (
        select(
            Deck.id,
            Deck.name,
            Deck.created_at,
            func.count(Card.id).label("card_count"),
            func.count(Card.id).filter(Card.due_at <= func.now()).label("due_count"),
        )
        .outerjoin(Card, Card.deck_id == Deck.id)
        .group_by(Deck.id)
    )


def _deck_out(db: Session, deck: Deck) -> DeckOut:
    row = db.execute(_decks_with_counts().where(Deck.id == deck.id)).one()
    return DeckOut.model_validate(row)


@router.get("")
def list_decks(user: CurrentUser, db: DbSession) -> list[DeckOut]:
    rows = db.execute(
        _decks_with_counts()
        .where(Deck.owner_id == user.id)
        .order_by(Deck.created_at.desc(), Deck.id.desc())
    )
    return [DeckOut.model_validate(row) for row in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_deck(body: DeckWrite, user: CurrentUser, db: DbSession) -> DeckOut:
    deck = Deck(owner_id=user.id, name=body.name)
    db.add(deck)
    db.commit()
    return _deck_out(db, deck)


@router.get("/{deck_id}")
def get_deck(deck: OwnedDeck, db: DbSession) -> DeckOut:
    return _deck_out(db, deck)


@router.patch("/{deck_id}")
def rename_deck(body: DeckWrite, deck: OwnedDeck, db: DbSession) -> DeckOut:
    deck.name = body.name
    db.commit()
    return _deck_out(db, deck)


@router.delete("/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deck(deck: OwnedDeck, db: DbSession) -> None:
    db.delete(deck)
    db.commit()


@router.get("/{deck_id}/cards")
def list_cards(deck: OwnedDeck, db: DbSession) -> list[CardOut]:
    cards = db.scalars(select(Card).where(Card.deck_id == deck.id).order_by(Card.id))
    return [CardOut.model_validate(card) for card in cards]


@router.post("/{deck_id}/cards", status_code=status.HTTP_201_CREATED)
def create_card(body: CardCreate, deck: OwnedDeck, db: DbSession) -> CardOut:
    card = Card(deck_id=deck.id, front=body.front, back=body.back)
    db.add(card)
    db.commit()
    return CardOut.model_validate(card)


@router.post("/{deck_id}/cards/bulk", status_code=status.HTTP_201_CREATED)
def create_cards(body: CardBulkCreate, deck: OwnedDeck, db: DbSession) -> list[CardOut]:
    cards = [
        Card(deck_id=deck.id, front=card.front, back=card.back) for card in body.cards
    ]
    db.add_all(cards)
    db.commit()
    return [CardOut.model_validate(card) for card in cards]


@router.get("/{deck_id}/cards/{card_id}")
def get_card(card: OwnedCard) -> CardOut:
    return CardOut.model_validate(card)


@router.patch("/{deck_id}/cards/{card_id}")
def update_card(body: CardUpdate, card: OwnedCard, db: DbSession) -> CardOut:
    if body.front is not None:
        card.front = body.front
    if body.back is not None:
        card.back = body.back
    db.commit()
    return CardOut.model_validate(card)


@router.delete("/{deck_id}/cards/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_card(card: OwnedCard, db: DbSession) -> None:
    db.delete(card)
    db.commit()
