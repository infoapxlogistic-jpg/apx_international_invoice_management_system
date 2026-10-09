from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

Money = Numeric(14, 2)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="staff")  # super_admin | staff
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Company(TimestampMixin, Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(150))
    tagline: Mapped[str | None] = mapped_column(String(200))
    address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(120))
    website: Mapped[str | None] = mapped_column(String(150))
    ntn: Mapped[str | None] = mapped_column(String(50))
    vat_number: Mapped[str | None] = mapped_column(String(50))
    currency_code: Mapped[str] = mapped_column(String(3), default="GBP")
    currency_symbol: Mapped[str] = mapped_column(String(5), default="£")
    currency_name: Mapped[str | None] = mapped_column(String(60))
    date_format: Mapped[str] = mapped_column(String(12), default="MM/DD/YYYY")
    payment_note: Mapped[str | None] = mapped_column(Text)
    default_description: Mapped[str | None] = mapped_column(Text)
    payment_terms_days: Mapped[int] = mapped_column(Integer, default=10)
    pay_online_url: Mapped[str | None] = mapped_column(String(255))
    bank_name: Mapped[str | None] = mapped_column(String(100))
    account_holder: Mapped[str | None] = mapped_column(String(150))
    account_number: Mapped[str | None] = mapped_column(String(50))
    sort_code: Mapped[str | None] = mapped_column(String(20))
    bic: Mapped[str | None] = mapped_column(String(20))
    iban: Mapped[str | None] = mapped_column(String(50))
    invoice_prefix: Mapped[str] = mapped_column(String(10))
    next_invoice_number: Mapped[int] = mapped_column(Integer, default=1)
    default_tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    bank_details: Mapped[str | None] = mapped_column(Text)
    terms: Mapped[str | None] = mapped_column(Text)
    brand_color: Mapped[str] = mapped_column(String(7), default="#e11d2e")
    logo_path: Mapped[str | None] = mapped_column(String(255))


class Customer(TimestampMixin, Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), index=True)
    ntn_cnic: Mapped[str | None] = mapped_column(String(50))
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(120))
    address: Mapped[str] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(80))
    county: Mapped[str | None] = mapped_column(String(80))
    country: Mapped[str | None] = mapped_column(String(80))
    postal_code: Mapped[str | None] = mapped_column(String(20))


class Invoice(TimestampMixin, Base):
    __tablename__ = "invoices"
    __table_args__ = (UniqueConstraint("company_id", "invoice_no", name="uq_company_invoice_no"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id"), index=True)
    invoice_no: Mapped[str] = mapped_column(String(30))
    invoice_date: Mapped[date] = mapped_column(Date, index=True)
    due_date: Mapped[date | None] = mapped_column(Date)
    currency_code: Mapped[str] = mapped_column(String(3), default="GBP")
    # How the customer pays (bank | cash | card | cheque) and whether it has already been received;
    # both only change what is printed on the invoice.
    payment_mode: Mapped[str] = mapped_column(String(10), default="bank")
    payment_received: Mapped[bool] = mapped_column(Boolean, default=False)

    # Customer details are copied onto the invoice so an issued invoice never
    # changes when the customer record is edited later.
    customer_name: Mapped[str] = mapped_column(String(150))
    customer_ntn_cnic: Mapped[str | None] = mapped_column(String(50))
    customer_phone: Mapped[str | None] = mapped_column(String(50))
    customer_email: Mapped[str | None] = mapped_column(String(120))
    customer_address: Mapped[str] = mapped_column(Text)
    customer_city: Mapped[str | None] = mapped_column(String(80))
    customer_county: Mapped[str | None] = mapped_column(String(80))
    customer_country: Mapped[str | None] = mapped_column(String(80))
    customer_postal_code: Mapped[str | None] = mapped_column(String(20))

    subtotal: Mapped[Decimal] = mapped_column(Money, default=0)
    taxable_total: Mapped[Decimal] = mapped_column(Money, default=0)
    non_taxable_total: Mapped[Decimal] = mapped_column(Money, default=0)
    discount: Mapped[Decimal] = mapped_column(Money, default=0)
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    tax_amount: Mapped[Decimal] = mapped_column(Money, default=0)
    total: Mapped[Decimal] = mapped_column(Money, default=0)
    amount_paid: Mapped[Decimal] = mapped_column(Money, default=0)
    status: Mapped[str] = mapped_column(String(20), default="unpaid", index=True)
    notes: Mapped[str | None] = mapped_column(Text)

    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    company: Mapped[Company] = relationship()
    created_by: Mapped[User | None] = relationship()
    items: Mapped[list["InvoiceItem"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan", order_by="InvoiceItem.position"
    )
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan", order_by="Payment.payment_date"
    )


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[str] = mapped_column(Text)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=1)
    unit_price: Mapped[Decimal] = mapped_column(Money, default=0)
    amount: Mapped[Decimal] = mapped_column(Money, default=0)
    taxable: Mapped[bool] = mapped_column(Boolean, default=False)

    invoice: Mapped[Invoice] = relationship(back_populates="items")


class Payment(TimestampMixin, Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), index=True)
    payment_date: Mapped[date] = mapped_column(Date)
    amount: Mapped[Decimal] = mapped_column(Money)
    method: Mapped[str] = mapped_column(String(30))  # cash | bank_transfer | cheque | card | other
    reference: Mapped[str | None] = mapped_column(String(120))
    notes: Mapped[str | None] = mapped_column(Text)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    invoice: Mapped[Invoice] = relationship(back_populates="payments")
