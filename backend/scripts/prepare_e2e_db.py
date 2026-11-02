"""Recreates the database that the browser tests run against."""

import sys

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, make_url, text

from app.config import BACKEND_DIR, settings

E2E_DATABASE = "minervus_e2e"


def main() -> int:
    url = make_url(settings.database_url)
    # This drops a database, so it must never run against any other one.
    if url.database != E2E_DATABASE:
        print(f"DATABASE_URL must point at {E2E_DATABASE}", file=sys.stderr)
        return 1

    server = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with server.connect() as connection:
        connection.execute(text(f"DROP DATABASE IF EXISTS {E2E_DATABASE} WITH (FORCE)"))
        connection.execute(text(f"CREATE DATABASE {E2E_DATABASE}"))
    server.dispose()

    config = Config(BACKEND_DIR / "alembic.ini")
    config.attributes["configure_logging"] = False
    command.upgrade(config, "head")
    return 0


if __name__ == "__main__":
    sys.exit(main())
