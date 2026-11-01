import os
from collections.abc import Callable, Iterator

# Settings are read on import, so this has to come before the app imports.
os.environ["JWT_SECRET"] = "test-secret-that-is-at-least-32-characters-long"

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.config import BACKEND_DIR, settings
from app.db import get_db
from app.main import app


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    config = Config(BACKEND_DIR / "alembic.ini")
    config.attributes["database_url"] = settings.test_database_url
    config.attributes["configure_logging"] = False
    command.upgrade(config, "head")

    engine = create_engine(settings.test_database_url)
    yield engine
    engine.dispose()


@pytest.fixture
def db(engine: Engine) -> Iterator[Session]:
    """A session whose changes roll back, even if the code under test commits."""
    with engine.connect() as connection:
        transaction = connection.begin()
        session = Session(
            bind=connection,
            join_transaction_mode="create_savepoint",
            expire_on_commit=False,
        )
        yield session
        session.close()
        transaction.rollback()


@pytest.fixture
def client_factory(db: Session) -> Iterator[Callable[[], TestClient]]:
    """Makes clients with separate cookie jars, one per logged-in person."""
    app.dependency_overrides[get_db] = lambda: db
    yield lambda: TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def client(client_factory: Callable[[], TestClient]) -> TestClient:
    return client_factory()
