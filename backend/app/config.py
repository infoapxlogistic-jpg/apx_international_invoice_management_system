from pathlib import Path

from pydantic import field_validator
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
    # Set to true for one start to force the admin account back to ADMIN_USERNAME / ADMIN_PASSWORD.
    reset_admin_password: bool = False

    # Company codes shown in the app, comma separated (e.g. "APX" or "APX,CRX").
    active_companies: str = "APX"

    # On Railway point this at the mounted volume (e.g. /data/uploads) so logos survive deploys.
    upload_dir: Path = BASE_DIR / "uploads"

    @field_validator("database_url")
    @classmethod
    def _use_pymysql(cls, v: str) -> str:
        # Railway (and most hosts) give "mysql://user:pass@host:port/db"; SQLAlchemy needs the driver named.
        if v.startswith("mysql://"):
            return "mysql+pymysql://" + v[len("mysql://"):]
        return v

    @property
    def active_company_codes(self) -> list[str]:
        return [c.strip().upper() for c in self.active_companies.split(",") if c.strip()]


settings = Settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)
