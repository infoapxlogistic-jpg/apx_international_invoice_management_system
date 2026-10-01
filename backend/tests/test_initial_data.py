"""A new database (e.g. first Railway deploy) gets the APXpress terms, email and invoice AP10001, once."""
from decimal import Decimal

from app.database import SessionLocal
from app.initial_data import APX_EMAIL, APX_TERMS
from app.models import Company, Invoice
from app.seed import init_db


def _apx(db):
    return db.query(Company).filter(Company.code == "APX").one()


def test_new_database_gets_apx_data(client, auth):
    with SessionLocal() as db:
        apx = _apx(db)
        assert apx.terms == APX_TERMS
        assert apx.email == APX_EMAIL
        first = db.query(Invoice).filter(Invoice.invoice_no == "AP10001").one()
        assert first.customer_name == "Eddys Wardrobe Ltd"
        assert first.subtotal == Decimal("9920.00")
        assert first.tax_amount == Decimal("80.00")
        assert first.total == Decimal("10000.00")
        assert [(i.description, i.taxable) for i in first.items] == [
            ("Cargo Charges Received on behalf of DGL", False),
            ("Service Charges", True),
        ]
        assert "Daily Global Logistics Limited" in first.notes


def test_new_database_gets_creonetix_details(client, auth):
    from app.config import settings
    from app.initial_data import CRX_TERMS

    with SessionLocal() as db:
        crx = db.query(Company).filter(Company.code == "CRX").one()
        assert crx.name == "Creonetix Limited"
        assert crx.address.splitlines() == ["450 Bath Road", "Longford", "Heathrow", "UB7 0EB", "United Kingdom"]
        assert (crx.email, crx.ntn, crx.vat_number) == ("admin@creonetix.co.uk", "16035489", "510965693")
        assert (crx.bank_name, crx.account_number, crx.sort_code) == ("Monzo", "81532899", "04-00-06")
        assert (crx.bic, crx.iban) == ("MONZGB2L", "GB89 MONZ 0400 0681 5328 99")
        assert crx.terms == CRX_TERMS and "within 7 days" in crx.terms
        assert crx.payment_terms_days == 7
        assert crx.invoice_prefix == "INVOICE-"
        assert crx.date_format == "DD MMM YYYY"
        assert crx.default_tax_rate == Decimal(20)
        assert crx.logo_path and (settings.upload_dir / crx.logo_path).is_file()
        apx = _apx(db)
        assert apx.logo_path and (settings.upload_dir / apx.logo_path).is_file()


def test_both_companies_are_listed(client, auth):
    codes = [c["code"] for c in client.get("/api/companies", headers=auth).json()]
    assert sorted(codes) == ["APX", "CRX"]


def test_creonetix_invoice_number_and_vat(client, auth):
    crx_id = next(c["id"] for c in client.get("/api/companies", headers=auth).json() if c["code"] == "CRX")
    r = client.post("/api/invoices", headers=auth, json={
        "company_id": crx_id, "invoice_date": "2026-10-01", "customer_name": "Test", "customer_address": "1 Road",
        "tax_rate": 20, "save_customer": False,
        "items": [{"description": "Cargo", "quantity": 1, "unit_price": 9520},
                  {"description": "Service", "quantity": 1, "unit_price": 400, "taxable": True}],
    })
    assert r.status_code == 201, r.text
    inv = r.json()
    assert inv["invoice_no"].startswith("INVOICE-")
    assert Decimal(inv["total"]) == Decimal("10000.00")
    with SessionLocal() as db:
        # Creonetix has issued an invoice now, so a restart must not touch its numbering.
        crx = db.query(Company).filter(Company.code == "CRX").one()
        nxt = crx.next_invoice_number
        crx.invoice_prefix = "CX-"
        db.commit()
    init_db()
    with SessionLocal() as db:
        crx = db.query(Company).filter(Company.code == "CRX").one()
        assert (crx.invoice_prefix, crx.next_invoice_number) == ("CX-", nxt)


def test_restart_does_not_duplicate_or_bring_back(client, auth):
    init_db()
    with SessionLocal() as db:
        assert db.query(Invoice).filter(Invoice.invoice_no == "AP10001").count() == 1
        inv_id = db.query(Invoice).filter(Invoice.invoice_no == "AP10001").one().id
    assert client.delete(f"/api/invoices/{inv_id}", headers=auth).status_code == 200
    init_db()
    with SessionLocal() as db:
        assert db.query(Invoice).filter(Invoice.invoice_no == "AP10001").count() == 0


def test_own_terms_are_not_overwritten(client, auth):
    with SessionLocal() as db:
        apx = _apx(db)
        apx.terms = "My own terms"
        apx.email = "me@example.com"
        db.commit()
    init_db()
    with SessionLocal() as db:
        apx = _apx(db)
        assert apx.terms == "My own terms"
        assert apx.email == "me@example.com"
