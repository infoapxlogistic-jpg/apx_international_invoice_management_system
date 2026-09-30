from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings


def _ensure_mysql_database(url_str: str) -> None:
    """Create the MySQL database on first run so setup is just 'fill .env and start'."""
    url = make_url(url_str)
    if not url.drivername.startswith("mysql") or not url.database:
        return
    server = create_engine(url.set(database=None), pool_pre_ping=True)
    with server.connect() as conn:
        conn.exec_driver_sql(
            f"CREATE DATABASE IF NOT EXISTS `{url.database}` "
            "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        )
    server.dispose()


_ensure_mysql_database(settings.database_url)

engine = create_engine(settings.database_url, pool_pre_ping=True, pool_recycle=3600)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
