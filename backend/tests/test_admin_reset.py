"""RESET_ADMIN_PASSWORD puts the admin account back to ADMIN_USERNAME / ADMIN_PASSWORD."""
from app.config import settings
from app.database import SessionLocal
from app.models import User
from app.security import hash_password
from app.seed import init_db


def test_reset_admin_password(client, monkeypatch):
    with SessionLocal() as db:
        admin = db.query(User).filter(User.username == "admin").one()
        admin.password_hash = hash_password("forgotten-password")
        admin.is_active = False
        db.commit()
    assert client.post("/api/auth/login", json={"username": "admin", "password": "admin123"}).status_code == 401

    monkeypatch.setattr(settings, "reset_admin_password", True)
    init_db()

    r = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["role"] == "super_admin"


def test_no_reset_when_flag_is_off(client):
    with SessionLocal() as db:
        admin = db.query(User).filter(User.username == "admin").one()
        admin.password_hash = hash_password("kept-password")
        db.commit()
    init_db()
    assert client.post("/api/auth/login", json={"username": "admin", "password": "kept-password"}).status_code == 200
    # put it back for other tests
    with SessionLocal() as db:
        admin = db.query(User).filter(User.username == "admin").one()
        admin.password_hash = hash_password("admin123")
        db.commit()
