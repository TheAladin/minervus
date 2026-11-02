from typing import Annotated

import anthropic
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app import pdf
from app.ai import (
    DEFAULT_CARDS,
    MAX_CARDS,
    MAX_SOURCE_CHARS,
    generate_card_drafts,
    get_anthropic_client,
)
from app.dependencies import DbSession, get_owned_deck
from app.schemas import CardDrafts

router = APIRouter(prefix="/api/decks", tags=["generate"])


def _read_source(text: str | None, file: UploadFile | None) -> str:
    text = text.strip() if text else ""
    if bool(text) == (file is not None):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Provide either text or a PDF."
        )

    if file is None:
        # Browsers send line breaks in forms as two characters but count them as one.
        text = text.replace("\r\n", "\n")
        if len(text) > MAX_SOURCE_CHARS:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                f"The text is longer than the {MAX_SOURCE_CHARS:,} character limit.",
            )
        return text

    data = file.file.read(pdf.MAX_PDF_BYTES + 1)
    if len(data) > pdf.MAX_PDF_BYTES:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE, "PDFs can be at most 10 MB."
        )
    try:
        return pdf.extract_text(data, MAX_SOURCE_CHARS)
    except pdf.PdfError as error:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)
        ) from error


@router.post("/{deck_id}/generate", dependencies=[Depends(get_owned_deck)])
def generate_cards(
    db: DbSession,
    client: Annotated[anthropic.Anthropic, Depends(get_anthropic_client)],
    text: Annotated[str | None, Form()] = None,
    file: Annotated[UploadFile | None, File()] = None,
    max_cards: Annotated[int, Form(ge=1, le=MAX_CARDS)] = DEFAULT_CARDS,
) -> CardDrafts:
    # Generation can take minutes, so the database connection goes back to the pool
    # first. Holding it would let a few of these requests use up the whole pool.
    db.close()
    source = _read_source(text, file)
    return CardDrafts(cards=generate_card_drafts(client, source, max_cards))
