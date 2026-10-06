"""Starting data for APXpress and Creonetix, applied when the app starts (e.g. the first Railway deploy).

Nothing here overwrites what someone has typed in the app:
- details are filled only while they are empty (or still an old built-in default);
- numbering and formats are set only for a company that has never issued an invoice;
- a logo is added only when the company has none (or its file is missing);
- the sample invoice AP10001 is created only if APXpress has never issued an invoice.
"""
import shutil
from datetime import date
from decimal import Decimal
from pathlib import Path

from sqlalchemy import func, select

from .config import settings
from .currencies import normalise
from .models import Company, Invoice, User

LOGO_DIR = Path(__file__).resolve().parent / "default_logos"

APX_EMAIL = "info.apxlogistic@gmail.com"

APX_TERMS = (
    "Payment Term: All invoices are payable within 10 days of the invoice date.\n"
    "Bank Transfer Name: Please ensure all bank transfers are made to APXpress Limited "
    "using the exact invoice number as the payment reference.\n"
    f"Queries: For any billing or invoice queries, please contact us directly at {APX_EMAIL}"
)

CRX_EMAIL = "admin@creonetix.co.uk"

CRX_TERMS = (
    "Payment Term: All invoices are payable within 7 days of the invoice date.\n"
    "Bank Transfer Name: Please ensure all bank transfers are made to Creonetix Limited "
    "using the exact invoice number as the payment reference.\n"
    f"Queries: For any billing or invoice queries, please contact us directly at {CRX_EMAIL}"
)

# From the client's own invoices (INVOICE-12650 for Creonetix).
COMPANY_DETAILS = {
    "APX": {
        "fill": {"email": APX_EMAIL, "terms": APX_TERMS, "account_holder": "APXPRESS LIMITED"},
        "fresh": {"payment_terms_days": 10},
        "logo": "apxpress.svg",
    },
    "CRX": {
        "fill": {
            "address": "450 Bath Road\nLongford\nHeathrow\nUB7 0EB\nUnited Kingdom",
            "email": CRX_EMAIL,
            "ntn": "16035489",
            "vat_number": "510965693",
            "bank_name": "Monzo",
            "account_holder": "CREONETIX LIMITED",
            "account_number": "81532899",
            "sort_code": "04-00-06",
            "bic": "MONZGB2L",
            "iban": "GB89 MONZ 0400 0681 5328 99",
            "terms": CRX_TERMS,
        },
        # Only while Creonetix has never issued an invoice from this system.
        "fresh": {
            "name": "Creonetix Limited",
            "tagline": "Design-Market-Thrive",
            "invoice_prefix": "INVOICE-",
            "next_invoice_number": 12651,
            "payment_terms_days": 7,
            "default_tax_rate": Decimal(20),
            "date_format": "DD MMM YYYY",
            "currency_code": "GBP",
            "currency_symbol": "£",
            "currency_name": "GBP Pound Sterling",
            "brand_color": "#e11d2e",
        },
        "logo": "creonetix.png",
    },
}

# Taken from the client's INVOICE-12650, issued by APXpress.
APX_FIRST_INVOICE = {
    "invoice_date": date(2026, 9, 25),
    "due_date": date(2026, 9, 28),
    "customer_name": "Eddys Wardrobe Ltd",
    "customer_address": "38 Cliffdale Drive",
    "customer_city": "Manchester",
    "customer_county": "Greater Manchester",
    "customer_postal_code": "M8 4QF",
    "customer_country": "United Kingdom",
    "tax_rate": Decimal(20),
    "notes": (
        "Acting as agent on behalf of:\n\n"
        "Daily Global Logistics Limited\n"
        "124 Cromwell Road\n"
        "Kensington, London, SW7 4ET\n"
        "VAT Number: GB 171 494 595\n\n"
        "Please pay directly into APXpress Limited Account."
    ),
    "items": [
        {"description": "Cargo Charges Received on behalf of DGL", "quantity": 1, "unit_price": 9520, "taxable": False},
        {"description": "Service Charges", "quantity": 1, "unit_price": 400, "taxable": True},
    ],
}


def _is_blank(value, old_defaults=()) -> bool:
    text = "" if value is None else str(value).strip()
    return text == "" or text in {d.strip() for d in old_defaults}


def _issued(db, company: Company) -> int:
    return db.scalar(select(func.count()).select_from(Invoice).where(Invoice.company_id == company.id))


def _ensure_logo(company: Company, filename: str) -> None:
    if company.logo_path and (settings.upload_dir / company.logo_path).is_file():
        return
    source = LOGO_DIR / filename
    if not source.is_file():
        return
    target = f"company_{company.id}_default{source.suffix}"
    shutil.copyfile(source, settings.upload_dir / target)
    company.logo_path = target
    print(f"[seed] {company.name}: default logo added", flush=True)


def apply_initial_data(db, old_default_terms) -> None:
    """old_default_terms: function(company_name) -> the terms text older versions put in by default."""
    for code, spec in COMPANY_DETAILS.items():
        company = db.scalar(select(Company).where(Company.code == code))
        if company is None:
            continue
        issued = _issued(db, company)
        # A company that has never issued an invoice still has its first-run numbering.
        fresh = issued == 0 and company.next_invoice_number in (1, 10001)
        if fresh:
            for field, value in spec["fresh"].items():
                setattr(company, field, value)
        old_terms = (old_default_terms(company.name), old_default_terms("Creonetix Limited"),
                     old_default_terms("APXpress Limited"))
        for field, value in spec["fill"].items():
            olds = old_terms if field == "terms" else ()
            if _is_blank(getattr(company, field), olds):
                setattr(company, field, value)
        _ensure_logo(company, spec["logo"])
        print(f"[seed] {company.name}: details checked (invoices issued: {issued})", flush=True)

        if code == "APX" and issued == 0 and company.next_invoice_number == 10001:
            _create_first_invoice(db, company)


def _create_first_invoice(db, apx: Company) -> None:
    # Reuse the same maths and customer handling as the invoice screen.
    from .routers.invoices import _apply, _link_customer
    from .schemas import InvoiceIn

    data = InvoiceIn(company_id=apx.id, save_customer=True, **APX_FIRST_INVOICE)
    admin = db.scalar(select(User).where(User.role == "super_admin").order_by(User.id))
    inv = Invoice(
        company_id=apx.id,
        invoice_no=f"{apx.invoice_prefix}{apx.next_invoice_number}",
        currency_code=normalise(apx.currency_code),
        amount_paid=Decimal(0),
        status="unpaid",
        created_by_id=admin.id if admin else None,
    )
    _apply(inv, data)
    _link_customer(db, inv, data)
    db.add(inv)
    apx.next_invoice_number += 1
    print(f"[seed] Invoice {inv.invoice_no} (Eddys Wardrobe Ltd, {inv.total}) created", flush=True)
