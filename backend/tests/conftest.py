"""Tests run against a throw-away SQLite database, never the real MySQL one."""
import os
import sys
import tempfile
from pathlib import Path

_db = Path(tempfile.gettempdir()) / "invoice_tests.db"
if _db.exists():
    _db.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{_db.as_posix()}"
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp(prefix="invoice_test_uploads_")
os.environ["ACTIVE_COMPANIES"] = "APX,CRX"
os.environ["ADMIN_USERNAME"] = "admin"
os.environ["ADMIN_PASSWORD"] = "admin123"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def auth(client):
    token = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def company_id(client, auth):
    return client.get("/api/companies", headers=auth).json()[0]["id"]


@pytest.fixture
def make_invoice(client, auth, company_id):
    """Create an invoice from (description, qty, unit_price, taxable) tuples; returns the saved invoice."""

    def make(items, tax_rate=20, discount=0, invoice_date="2026-09-25", expect=201):
        body = {
            "company_id": company_id,
            "invoice_date": invoice_date,
            "customer_name": "Test Customer Ltd",
            "customer_address": "1 Test Street",
            "tax_rate": tax_rate,
            "discount": discount,
            "save_customer": False,
            "items": [
                {"description": d, "quantity": q, "unit_price": p, "taxable": t} for d, q, p, t in items
            ],
        }
        r = client.post("/api/invoices", headers=auth, json=body)
        assert r.status_code == expect, r.text
        return r.json()

    return make
