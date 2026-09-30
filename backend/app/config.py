from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    database_url: str = "mysql+pymysql://root:@localhost:3306/invoice_db"
    secret_key: str = "change-me"
    access_token_minutes: int = 60 * 12
    cors_origins: str = "*"

    admin_username: str = "admin"
    admin_password: str = "admin123"

    # Company codes shown in the app, comma separated (e.g. "APX" or "APX,CRX").
    active_companies: str = "APX"

    upload_dir: Path = BASE_DIR / "uploads"

    @property
    def active_company_codes(self) -> list[str]:
        return [c.strip().upper() for c in self.active_companies.split(",") if c.strip()]


settings = Settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)
