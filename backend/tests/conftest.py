import os
from collections.abc import Callable, Iterator

# Settings are read on import, so this has to come before the app imports.
os.environ["JWT_SECRET"] = "test-secret-that-is-at-least-32-characters-long"
# Without a key, a test that forgets the fake client gets a 503, not a real API call.
os.environ["ANTHROPIC_API_KEY"] = ""

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.config import BACKEND_DIR, settings
from app.db import create_db_engine, get_db
from app.main import app


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    config = Config(BACKEND_DIR / "alembic.ini")
    config.attributes["database_url"] = settings.test_database_url
    config.attributes["configure_logging"] = False
    command.upgrade(config, "head")

    engine = create_db_engine(settings.test_database_url)
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
def get_test_db(db: Session) -> Callable[[], Iterator[Session]]:
    """Stands in for get_db. Like a real request, it loses anything not committed."""

    def get_session() -> Iterator[Session]:
        try:
            yield db
        finally:
            db.rollback()

    return get_session


@pytest.fixture
def client_factory(
    get_test_db: Callable[[], Iterator[Session]],
) -> Iterator[Callable[[], TestClient]]:
    """Makes clients with separate cookie jars, one per logged-in person."""
    app.dependency_overrides[get_db] = get_test_db
    yield lambda: TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def client(client_factory: Callable[[], TestClient]) -> TestClient:
    return client_factory()
