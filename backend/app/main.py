import logging
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db import get_db
from app.routers import admin, auth, decks

logger = logging.getLogger(__name__)

app = FastAPI(title="Minervus")
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(decks.router)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    # The default handler echoes the input back, including rejected passwords.
    errors = [
        {"loc": error["loc"], "msg": error["msg"], "type": error["type"]}
        for error in exc.errors()
    ]
    return JSONResponse({"detail": errors}, status.HTTP_422_UNPROCESSABLE_CONTENT)


@app.get("/api/health")
def health(db: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        logger.exception("Database health check failed")
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Database unavailable"
        ) from exc
    return {"status": "ok"}
