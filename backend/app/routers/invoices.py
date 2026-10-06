from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..currencies import info as currency_info
from ..currencies import normalise as currency_code_of
from ..currencies import round_money
from ..database import get_db
from ..models import Company, Customer, Invoice, InvoiceItem, Payment, User
from ..schemas import (
    InvoiceIn,
    InvoiceItemOut,
    InvoiceOut,
    InvoicePage,
    InvoiceSummary,
    PaymentIn,
    PaymentOut,
)
from ..security import current_user, require_admin
from .companies import active_company_ids, company_out

router = APIRouter(prefix="/invoices", tags=["invoices"])

CENT = Decimal("0.01")
OPEN_STATUSES = ("unpaid", "partial")


def money(value) -> Decimal:
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def is_overdue(inv: Invoice) -> bool:
    return bool(inv.due_date and inv.due_date < date.today() and inv.status in OPEN_STATUSES)


def refresh_status(inv: Invoice) -> None:
    if inv.status == "cancelled":
        return
    paid, total = money(inv.amount_paid), money(inv.total)
    if paid <= 0 and total > 0:
        inv.status = "unpaid"
    elif paid < total:
        inv.status = "partial"
    else:
        inv.status = "paid"


def summary(inv: Invoice) -> InvoiceSummary:
    cur = currency_info(inv.currency_code)
    return InvoiceSummary(
        id=inv.id,
        company_id=inv.company_id,
        company_name=inv.company.name,
        company_code=inv.company.code,
        currency_code=cur["code"],
        currency_symbol=cur["symbol"],
        currency_name=cur["name"],
        currency_decimals=cur["decimals"],
        invoice_no=inv.invoice_no,
        invoice_date=inv.invoice_date,
        due_date=inv.due_date,
        customer_name=inv.customer_name,
        customer_phone=inv.customer_phone,
        net_amount=round_money(inv.subtotal - inv.discount, inv.currency_code),
        vat_amount=inv.tax_amount,
        total=inv.total,
        amount_paid=inv.amount_paid,
        balance=round_money(inv.total - inv.amount_paid, inv.currency_code) if inv.status != "cancelled" else Decimal(0),
        status=inv.status,
        overdue=is_overdue(inv),
    )


def detail(inv: Invoice) -> InvoiceOut:
    base = summary(inv).model_dump()
    return InvoiceOut(
        **base,
        customer_id=inv.customer_id,
        customer_ntn_cnic=inv.customer_ntn_cnic,
        customer_email=inv.customer_email,
        customer_address=inv.customer_address,
        customer_city=inv.customer_city,
        customer_county=inv.customer_county,
        customer_country=inv.customer_country,
        customer_postal_code=inv.customer_postal_code,
        subtotal=inv.subtotal,
        taxable_total=inv.taxable_total,
        non_taxable_total=inv.non_taxable_total,
        discount=inv.discount,
        tax_rate=inv.tax_rate,
        tax_amount=inv.tax_amount,
        notes=inv.notes,
        created_by_name=inv.created_by.full_name if inv.created_by else None,
        created_at=inv.created_at,
        items=[InvoiceItemOut.model_validate(i) for i in inv.items],
        payments=[PaymentOut.model_validate(p) for p in inv.payments],
        company=company_out(inv.company),
    )


def _load(db: Session, invoice_id: int) -> Invoice:
    inv = db.scalar(
        select(Invoice)
        .options(
            selectinload(Invoice.items),
            selectinload(Invoice.payments),
            selectinload(Invoice.company),
            selectinload(Invoice.created_by),
        )
        .where(Invoice.id == invoice_id)
    )
    if inv is None or inv.company_id not in active_company_ids(db):
        raise HTTPException(404, "Invoice not found")
    return inv


def _apply(inv: Invoice, data: InvoiceIn) -> None:
    """Copy form data onto the invoice and recompute every total on the server."""
    def money(value):  # rounds to the invoice currency (pence, cents, whole yen)
        return round_money(value, inv.currency_code)

    for field in (
        "invoice_date", "due_date", "customer_name", "customer_ntn_cnic", "customer_phone",
        "customer_email", "customer_address", "customer_city", "customer_county", "customer_country",
        "customer_postal_code", "notes",
    ):
        setattr(inv, field, getattr(data, field))
    if data.due_date and data.due_date < data.invoice_date:
        raise HTTPException(400, "Due date cannot be before the invoice date")

    inv.items = []
    taxable = Decimal(0)
    non_taxable = Decimal(0)
    for pos, item in enumerate(data.items):
        amount = money(item.quantity * item.unit_price)
        if item.taxable:
            taxable += amount
        else:
            non_taxable += amount
        inv.items.append(
            InvoiceItem(
                position=pos,
                description=item.description.strip(),
                quantity=item.quantity,
                unit_price=money(item.unit_price),
                amount=amount,
                taxable=item.taxable,
            )
        )
    subtotal = taxable + non_taxable
    discount = money(data.discount)
    if discount > subtotal:
        raise HTTPException(400, "Discount cannot be more than the subtotal")
    # VAT is charged only on lines marked taxable; a discount reduces the taxable part first.
    taxable_after_discount = max(Decimal(0), taxable - discount)
    tax_amount = money(taxable_after_discount * data.tax_rate / 100)

    inv.taxable_total = money(taxable)
    inv.non_taxable_total = money(non_taxable)
    inv.subtotal = money(subtotal)
    inv.discount = discount
    inv.tax_rate = data.tax_rate
    inv.tax_amount = tax_amount
    inv.total = money(subtotal - discount + tax_amount)
    if money(inv.amount_paid or 0) > inv.total:
        raise HTTPException(
            400, "The new total is less than the amount already received. Remove a payment first."
        )
    refresh_status(inv)


def _number_taken(db: Session, company_id: int, invoice_no: str) -> bool:
    return db.scalar(
        select(Invoice.id).where(Invoice.company_id == company_id, Invoice.invoice_no == invoice_no)
    ) is not None


def _check_number_free(db: Session, company_id: int, invoice_no: str) -> None:
    if _number_taken(db, company_id, invoice_no):
        raise HTTPException(400, f"Invoice number {invoice_no} is already used")


def _link_customer(db: Session, inv: Invoice, data: InvoiceIn) -> None:
    if data.customer_id:
        if db.get(Customer, data.customer_id) is None:
            raise HTTPException(400, "Selected customer no longer exists")
        inv.customer_id = data.customer_id
        return
    if not data.save_customer:
        inv.customer_id = None
        return
    existing = db.scalar(
        select(Customer).where(
            Customer.name == data.customer_name, Customer.phone == data.customer_phone
        )
    )
    if existing is None:
        existing = Customer(
            name=data.customer_name,
            ntn_cnic=data.customer_ntn_cnic,
            phone=data.customer_phone,
            email=data.customer_email,
            address=data.customer_address,
            city=data.customer_city,
            county=data.customer_county,
            country=data.customer_country,
            postal_code=data.customer_postal_code,
        )
        db.add(existing)
        db.flush()
    inv.customer_id = existing.id


@router.get("", response_model=InvoicePage, dependencies=[Depends(current_user)])
def list_invoices(
    company_id: int | None = None,
    customer_id: int | None = None,
    status: str | None = Query(None, pattern="^(unpaid|partial|paid|cancelled|overdue|open)$"),
    q: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),
    db: Session = Depends(get_db),
):
    stmt = select(Invoice).where(Invoice.company_id.in_(active_company_ids(db)))
    if company_id:
        stmt = stmt.where(Invoice.company_id == company_id)
    if customer_id:
        stmt = stmt.where(Invoice.customer_id == customer_id)
    if status == "overdue":
        stmt = stmt.where(Invoice.status.in_(OPEN_STATUSES), Invoice.due_date < date.today())
    elif status == "open":
        stmt = stmt.where(Invoice.status.in_(OPEN_STATUSES))
    elif status:
        stmt = stmt.where(Invoice.status == status)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Invoice.invoice_no.ilike(like),
                Invoice.customer_name.ilike(like),
                Invoice.customer_phone.ilike(like),
                Invoice.customer_ntn_cnic.ilike(like),
            )
        )
    if date_from:
        stmt = stmt.where(Invoice.invoice_date >= date_from)
    if date_to:
        stmt = stmt.where(Invoice.invoice_date <= date_to)

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(
        stmt.options(selectinload(Invoice.company))
        .order_by(Invoice.invoice_date.desc(), Invoice.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return InvoicePage(items=[summary(i) for i in rows], total=total, page=page, page_size=page_size)


@router.get("/{invoice_id}", response_model=InvoiceOut, dependencies=[Depends(current_user)])
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    return detail(_load(db, invoice_id))


@router.post("", response_model=InvoiceOut, status_code=201)
def create_invoice(data: InvoiceIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    # Lock the company row so two people saving at once never get the same number.
    company = db.scalar(select(Company).where(Company.id == data.company_id).with_for_update())
    if company is None or company.id not in active_company_ids(db):
        raise HTTPException(400, "Company not found")

    custom_no = (data.invoice_no or "").strip()
    if custom_no:
        _check_number_free(db, company.id, custom_no)
        invoice_no = custom_no
    else:
        # Skip numbers already taken by hand so the automatic number never collides.
        number = company.next_invoice_number
        while _number_taken(db, company.id, f"{company.invoice_prefix}{number}"):
            number += 1
        invoice_no = f"{company.invoice_prefix}{number}"
        company.next_invoice_number = number + 1
    inv = Invoice(
        company_id=company.id,
        invoice_no=invoice_no,
        currency_code=data.currency_code or currency_code_of(company.currency_code),
        amount_paid=Decimal(0),
        status="unpaid",
        created_by_id=user.id,
    )
    _apply(inv, data)
    _link_customer(db, inv, data)
    db.add(inv)
    db.commit()
    return detail(_load(db, inv.id))


@router.put("/{invoice_id}", response_model=InvoiceOut, dependencies=[Depends(current_user)])
def update_invoice(invoice_id: int, data: InvoiceIn, db: Session = Depends(get_db)):
    inv = _load(db, invoice_id)
    if inv.status == "cancelled":
        raise HTTPException(400, "A cancelled invoice cannot be edited")
    if data.company_id != inv.company_id:
        raise HTTPException(400, "An invoice cannot be moved to another company")
    if data.currency_code:
        inv.currency_code = data.currency_code
    new_no = (data.invoice_no or "").strip()
    if new_no and new_no != inv.invoice_no:
        _check_number_free(db, inv.company_id, new_no)
        inv.invoice_no = new_no
    _apply(inv, data)
    _link_customer(db, inv, data)
    db.commit()
    return detail(_load(db, inv.id))


@router.delete("/{invoice_id}", dependencies=[Depends(require_admin)])
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    inv = _load(db, invoice_id)
    db.delete(inv)
    db.commit()
    return {"ok": True}


@router.post("/{invoice_id}/cancel", response_model=InvoiceOut, dependencies=[Depends(require_admin)])
def cancel_invoice(invoice_id: int, db: Session = Depends(get_db)):
    inv = _load(db, invoice_id)
    if inv.payments:
        raise HTTPException(400, "Remove the payments on this invoice before cancelling it")
    inv.status = "cancelled"
    db.commit()
    return detail(_load(db, inv.id))


@router.post("/{invoice_id}/restore", response_model=InvoiceOut, dependencies=[Depends(require_admin)])
def restore_invoice(invoice_id: int, db: Session = Depends(get_db)):
    inv = _load(db, invoice_id)
    if inv.status != "cancelled":
        raise HTTPException(400, "Invoice is not cancelled")
    inv.status = "unpaid"
    refresh_status(inv)
    db.commit()
    return detail(_load(db, inv.id))


@router.post("/{invoice_id}/payments", response_model=InvoiceOut, status_code=201)
def add_payment(
    invoice_id: int, data: PaymentIn, db: Session = Depends(get_db), user: User = Depends(current_user)
):
    inv = _load(db, invoice_id)
    if inv.status == "cancelled":
        raise HTTPException(400, "Cannot take a payment on a cancelled invoice")
    amount = money(data.amount)
    balance = money(inv.total - inv.amount_paid)
    if amount > balance:
        raise HTTPException(400, f"Payment is more than the balance due ({balance})")
    inv.payments.append(
        Payment(
            payment_date=data.payment_date,
            amount=amount,
            method=data.method,
            reference=(data.reference or "").strip() or None,
            notes=(data.notes or "").strip() or None,
            created_by_id=user.id,
        )
    )
    inv.amount_paid = money(inv.amount_paid + amount)
    refresh_status(inv)
    db.commit()
    return detail(_load(db, inv.id))


@router.delete(
    "/{invoice_id}/payments/{payment_id}",
    response_model=InvoiceOut,
    dependencies=[Depends(require_admin)],
)
def delete_payment(invoice_id: int, payment_id: int, db: Session = Depends(get_db)):
    inv = _load(db, invoice_id)
    payment = next((p for p in inv.payments if p.id == payment_id), None)
    if payment is None:
        raise HTTPException(404, "Payment not found")
    inv.payments.remove(payment)
    inv.amount_paid = money(inv.amount_paid - payment.amount)
    refresh_status(inv)
    db.commit()
    return detail(_load(db, inv.id))
