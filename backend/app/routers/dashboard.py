from collections import defaultdict
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..currencies import info as currency_info
from ..currencies import normalise
from ..database import get_db
from ..models import Invoice
from ..security import current_user
from .companies import active_companies_query
from .invoices import summary

router = APIRouter(prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(current_user)])


def _bucket(code: str) -> dict:
    cur = currency_info(code)
    return {
        "currency_code": cur["code"],
        "currency_symbol": cur["symbol"],
        "currency_decimals": cur["decimals"],
        "count": 0,
        "subtotal": Decimal(0),
        "tax": Decimal(0),
        "total": Decimal(0),
    }


def _add(bucket: dict, inv: Invoice) -> None:
    bucket["count"] += 1
    bucket["subtotal"] += inv.subtotal - inv.discount
    bucket["tax"] += inv.tax_amount
    bucket["total"] += inv.total


def _ordered(buckets: dict, home: str) -> list[dict]:
    # The company's own currency first, then the others alphabetically.
    return [buckets[k] for k in sorted(buckets, key=lambda c: (c != home, c))]


@router.get("")
def dashboard(db: Session = Depends(get_db)):
    """Monthly record of invoices per company. Totals are kept per currency and never added across currencies."""
    today = date.today()
    this_month = today.strftime("%Y-%m")
    this_year = str(today.year)

    companies = db.scalars(active_companies_query()).all()
    ids = [c.id for c in companies]
    invoices = db.scalars(
        select(Invoice).where(Invoice.status != "cancelled", Invoice.company_id.in_(ids))
    ).all()

    data = {}
    for c in companies:
        home = normalise(c.currency_code)
        data[c.id] = {
            "company": c,
            "home": home,
            "all": {},
            "month": {},
            "year": {},
            "monthly": defaultdict(dict),
        }

    for inv in invoices:
        d = data[inv.company_id]
        code = normalise(inv.currency_code)
        key = inv.invoice_date.strftime("%Y-%m")
        _add(d["all"].setdefault(code, _bucket(code)), inv)
        if key == this_month:
            _add(d["month"].setdefault(code, _bucket(code)), inv)
        if key.startswith(this_year):
            _add(d["year"].setdefault(code, _bucket(code)), inv)
        _add(d["monthly"][key].setdefault(code, _bucket(code)), inv)

    result = []
    for d in data.values():
        c, home = d["company"], d["home"]
        monthly = d["monthly"]
        monthly.setdefault(this_month, {})
        rows = []
        for key in sorted(monthly, reverse=True):
            buckets = monthly[key] or {home: _bucket(home)}
            rows.extend({"month": key, **b} for b in _ordered(buckets, home))
        result.append({
            "company_id": c.id,
            "company_name": c.name,
            "company_code": c.code,
            "brand_color": c.brand_color,
            "currency_code": home,
            "invoice_count": sum(b["count"] for b in d["all"].values()),
            "all": _ordered(d["all"], home) or [_bucket(home)],
            "this_month": _ordered(d["month"], home) or [_bucket(home)],
            "this_year": _ordered(d["year"], home) or [_bucket(home)],
            "monthly": rows,
        })

    recent = db.scalars(
        select(Invoice)
        .options(selectinload(Invoice.company))
        .where(Invoice.company_id.in_(ids))
        .order_by(Invoice.created_at.desc(), Invoice.id.desc())
        .limit(8)
    ).all()

    return {"companies": result, "recent": [summary(i) for i in recent]}
