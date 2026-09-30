from sqlalchemy import inspect, select

from .config import settings
from .database import Base, SessionLocal, engine
from .models import Company, User
from .security import hash_password

PAYMENT_NOTE = (
    "Please note that all payments must be made by bank transfer. We do not accept cash "
    "deposited into our accounts at bank branches, i.e. NOT over the counter or via a branch ATM machine."
)

def default_terms(company_name: str) -> str:
    return (
        "Payment Term: All invoices are payable within 10 days of the invoice date.\n"
        f"Bank Transfer Name: Please ensure all bank transfers are made to {company_name} "
        "using the exact invoice number as the payment reference."
    )


DEFAULT_COMPANIES = [
    {
        "code": "CRX",
        "name": "Creonetix Limited",
        "tagline": "Design-Market-Thrive",
        "invoice_prefix": "CR",
        "next_invoice_number": 10001,
        "brand_color": "#e11d2e",
    },
    {
        "code": "APX",
        "name": "APXpress Limited",
        "tagline": "Where we think, This is fast!",
        "invoice_prefix": "AP",
        "next_invoice_number": 10001,
        "brand_color": "#1e2a8a",
    },
]

# Columns added after the first release. create_all() only makes missing tables,
# so existing databases get these added here.
NEW_COLUMNS = {
    "companies": {
        "vat_number": "VARCHAR(50) NULL",
        "currency_name": "VARCHAR(60) NULL",
        "date_format": "VARCHAR(12) NOT NULL DEFAULT 'MM/DD/YYYY'",
        "payment_note": "TEXT NULL",
        "default_description": "TEXT NULL",
        "payment_terms_days": "INTEGER NOT NULL DEFAULT 10",
        "pay_online_url": "VARCHAR(255) NULL",
        "bank_name": "VARCHAR(100) NULL",
        "account_holder": "VARCHAR(150) NULL",
        "account_number": "VARCHAR(50) NULL",
        "sort_code": "VARCHAR(20) NULL",
        "bic": "VARCHAR(20) NULL",
        "iban": "VARCHAR(50) NULL",
    },
    "customers": {
        "county": "VARCHAR(80) NULL",
    },
    "invoices": {
        "customer_county": "VARCHAR(80) NULL",
        "taxable_total": "NUMERIC(14,2) NOT NULL DEFAULT 0",
        "non_taxable_total": "NUMERIC(14,2) NOT NULL DEFAULT 0",
    },
    "invoice_items": {
        "taxable": "BOOLEAN NOT NULL DEFAULT 0",
    },
}

# Fields that became optional (MySQL only; SQLite test databases are always created fresh).
NOW_OPTIONAL = {
    "customers": {"ntn_cnic": "VARCHAR(50)", "phone": "VARCHAR(50)"},
    "invoices": {"customer_ntn_cnic": "VARCHAR(50)", "customer_phone": "VARCHAR(50)"},
}


def _migrate() -> None:
    insp = inspect(engine)
    with engine.begin() as conn:
        for table, columns in NEW_COLUMNS.items():
            existing = {c["name"] for c in insp.get_columns(table)}
            for name, ddl in columns.items():
                if name not in existing:
                    conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")
        if engine.dialect.name == "mysql":
            for table, columns in NOW_OPTIONAL.items():
                nullable = {c["name"]: c["nullable"] for c in insp.get_columns(table)}
                for name, ddl in columns.items():
                    if not nullable.get(name, True):
                        conn.exec_driver_sql(f"ALTER TABLE {table} MODIFY {name} {ddl} NULL")


def init_db() -> None:
    """Create tables and the starting data. Safe to run on every start."""
    Base.metadata.create_all(engine)
    _migrate()
    with SessionLocal() as db:
        if db.scalar(select(User).limit(1)) is None:
            db.add(
                User(
                    username=settings.admin_username,
                    full_name="Admin",
                    role="super_admin",
                    password_hash=hash_password(settings.admin_password),
                )
            )
        for data in DEFAULT_COMPANIES:
            if data["code"] not in settings.active_company_codes:
                continue
            if db.scalar(select(Company).where(Company.code == data["code"])) is None:
                db.add(
                    Company(
                        currency_code="GBP",
                        currency_symbol="£",
                        currency_name="GBP Pound Sterling",
                        date_format="DD MMM YYYY",
                        default_tax_rate=20,
                        payment_terms_days=10,
                        account_holder=data["name"].upper(),
                        terms=default_terms(data["name"]),
                        **data,
                    )
                )
        db.commit()


if __name__ == "__main__":
    init_db()
    print("Database ready.")
