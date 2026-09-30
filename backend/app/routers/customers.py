from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Customer, Invoice
from ..schemas import CustomerIn, CustomerOut
from ..security import current_user, require_admin

router = APIRouter(prefix="/customers", tags=["customers"], dependencies=[Depends(current_user)])


def _stats_query():
    active = Invoice.status != "cancelled"
    return (
        select(
            Invoice.customer_id,
            func.count(Invoice.id).label("invoice_count"),
            func.coalesce(func.sum(Invoice.total), 0).label("total_billed"),
            func.coalesce(func.sum(Invoice.total - Invoice.amount_paid), 0).label("balance_due"),
        )
        .where(active, Invoice.customer_id.is_not(None))
        .group_by(Invoice.customer_id)
        .subquery()
    )


def _out(customer: Customer, count=0, billed=0, balance=0) -> CustomerOut:
    out = CustomerOut.model_validate(customer)
    out.invoice_count = int(count or 0)
    out.total_billed = Decimal(billed or 0)
    out.balance_due = Decimal(balance or 0)
    return out


@router.get("", response_model=list[CustomerOut])
def list_customers(
    q: str | None = None, limit: int = Query(200, le=500), db: Session = Depends(get_db)
):
    stats = _stats_query()
    stmt = (
        select(Customer, stats.c.invoice_count, stats.c.total_billed, stats.c.balance_due)
        .outerjoin(stats, stats.c.customer_id == Customer.id)
        .order_by(Customer.name)
        .limit(limit)
    )
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(Customer.name.ilike(like), Customer.phone.ilike(like), Customer.ntn_cnic.ilike(like))
        )
    return [_out(*row) for row in db.execute(stmt).all()]


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    stats = _stats_query()
    row = db.execute(
        select(Customer, stats.c.invoice_count, stats.c.total_billed, stats.c.balance_due)
        .outerjoin(stats, stats.c.customer_id == Customer.id)
        .where(Customer.id == customer_id)
    ).first()
    if row is None:
        raise HTTPException(404, "Customer not found")
    return _out(*row)


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(data: CustomerIn, db: Session = Depends(get_db)):
    customer = Customer(**data.model_dump())
    db.add(customer)
    db.commit()
    return _out(customer)


@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: int, data: CustomerIn, db: Session = Depends(get_db)):
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(404, "Customer not found")
    for key, value in data.model_dump().items():
        setattr(customer, key, value)
    db.commit()
    return get_customer(customer_id, db)


@router.delete("/{customer_id}", dependencies=[Depends(require_admin)])
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(404, "Customer not found")
    used = db.scalar(select(func.count()).select_from(Invoice).where(Invoice.customer_id == customer_id))
    if used:
        raise HTTPException(400, f"This customer has {used} invoice(s) and cannot be deleted")
    db.delete(customer)
    db.commit()
    return {"ok": True}
