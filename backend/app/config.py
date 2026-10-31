from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    database_url: str = "postgresql+psycopg://minervus:minervus@localhost:5433/minervus"
    test_database_url: str = (
        "postgresql+psycopg://minervus:minervus@localhost:5433/minervus_test"
    )


settings = Settings()
