from collections.abc import Iterator

from sqlalchemy import Engine, MetaData, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


def create_db_engine(url: str) -> Engine:
    # With UTC sessions, adding days to a timestamp gives exact 24-hour days across
    # clock changes, and the API always reports times at the same offset.
    return create_engine(
        url, pool_pre_ping=True, connect_args={"options": "-c timezone=UTC"}
    )


engine = create_db_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(column_0_label)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
