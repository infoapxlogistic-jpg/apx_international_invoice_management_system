from collections import defaultdict
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Invoice
from ..security import current_user
from .companies import active_companies_query
from .invoices import summary

router = APIRouter(prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(current_user)])


def _empty_month(key: str) -> dict:
    return {"month": key, "count": 0, "subtotal": Decimal(0), "tax": Decimal(0), "total": Decimal(0)}


@router.get("")
def dashboard(db: Session = Depends(get_db)):
    """Monthly record of invoices: counts and totals per month, per company."""
    today = date.today()
    this_month = today.strftime("%Y-%m")
    this_year = str(today.year)

    companies = db.scalars(active_companies_query()).all()
    ids = [c.id for c in companies]
    invoices = db.scalars(
        select(Invoice).where(Invoice.status != "cancelled", Invoice.company_id.in_(ids))
    ).all()

    per_company = {
        c.id: {
            "company_id": c.id,
            "company_name": c.name,
            "company_code": c.code,
            "currency_symbol": c.currency_symbol,
            "brand_color": c.brand_color,
            "invoice_count": 0,
            "total": Decimal(0),
            "this_month_count": 0,
            "this_month_total": Decimal(0),
            "this_year_total": Decimal(0),
            "months": defaultdict(lambda: None),
        }
        for c in companies
    }

    for inv in invoices:
        s = per_company[inv.company_id]
        key = inv.invoice_date.strftime("%Y-%m")
        s["invoice_count"] += 1
        s["total"] += inv.total
        if key == this_month:
            s["this_month_count"] += 1
            s["this_month_total"] += inv.total
        if key.startswith(this_year):
            s["this_year_total"] += inv.total
        m = s["months"][key] or _empty_month(key)
        m["count"] += 1
        m["subtotal"] += inv.subtotal - inv.discount
        m["tax"] += inv.tax_amount
        m["total"] += inv.total
        s["months"][key] = m

    for s in per_company.values():
        # Every month that has invoices, newest first, plus the current month even when empty.
        months = {k: v for k, v in s["months"].items() if v}
        months.setdefault(this_month, _empty_month(this_month))
        s["monthly"] = [months[k] for k in sorted(months, reverse=True)]
        del s["months"]

    recent = db.scalars(
        select(Invoice)
        .options(selectinload(Invoice.company))
        .where(Invoice.company_id.in_(ids))
        .order_by(Invoice.created_at.desc(), Invoice.id.desc())
        .limit(8)
    ).all()

    return {"companies": list(per_company.values()), "recent": [summary(i) for i in recent]}
