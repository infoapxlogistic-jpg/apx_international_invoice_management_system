from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Role = Literal["super_admin", "staff"]
PaymentMethod = Literal["cash", "bank_transfer", "cheque", "card", "other"]
InvoiceStatus = Literal["unpaid", "partial", "paid", "cancelled"]
DateFormat = Literal["DD MMM YYYY", "MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]


def _strip(v):
    return v.strip() if isinstance(v, str) else v


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth / users ----------

class LoginIn(BaseModel):
    username: str
    password: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


class UserOut(ORM):
    id: int
    username: str
    full_name: str
    role: Role
    is_active: bool
    created_at: datetime | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    full_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=6)
    role: Role = "staff"

    _s = field_validator("username", "full_name", mode="before")(_strip)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    role: Role | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=6)


# ---------- Companies ----------

class CompanyBase(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    tagline: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    website: str | None = None
    ntn: str | None = None
    vat_number: str | None = None
    currency_code: str = Field(default="GBP", min_length=3, max_length=3)
    currency_symbol: str = Field(default="£", min_length=1, max_length=5)
    currency_name: str | None = None
    date_format: DateFormat = "DD MMM YYYY"
    invoice_prefix: str = Field(min_length=1, max_length=10)
    next_invoice_number: int = Field(ge=1)
    payment_note: str | None = None
    default_description: str | None = None
    payment_terms_days: int = Field(default=10, ge=0, le=365)
    pay_online_url: str | None = Field(default=None, max_length=255)
    bank_name: str | None = Field(default=None, max_length=100)
    account_holder: str | None = Field(default=None, max_length=150)
    account_number: str | None = Field(default=None, max_length=50)
    sort_code: str | None = Field(default=None, max_length=20)
    bic: str | None = Field(default=None, max_length=20)
    iban: str | None = Field(default=None, max_length=50)
    default_tax_rate: Decimal = Field(default=Decimal(0), ge=0, le=100)
    bank_details: str | None = None
    terms: str | None = None
    brand_color: str = Field(default="#e11d2e", pattern=r"^#[0-9a-fA-F]{6}$")


class CompanyUpdate(CompanyBase):
    pass


class CompanyOut(CompanyBase, ORM):
    id: int
    code: str
    logo_url: str | None = None


# ---------- Customers ----------

class CustomerBase(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    ntn_cnic: str | None = Field(default=None, max_length=50)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = None
    address: str = Field(min_length=1)
    city: str | None = None
    county: str | None = None
    country: str | None = None
    postal_code: str | None = None

    _s = field_validator("*", mode="before")(_strip)


class CustomerIn(CustomerBase):
    pass


class CustomerOut(CustomerBase, ORM):
    id: int
    invoice_count: int = 0
    total_billed: Decimal = Decimal(0)
    balance_due: Decimal = Decimal(0)


# ---------- Invoices ----------

class InvoiceItemIn(BaseModel):
    description: str = Field(min_length=1)
    quantity: Decimal = Field(default=Decimal(1), gt=0)
    unit_price: Decimal = Field(ge=0)
    taxable: bool = False


class InvoiceItemOut(ORM):
    id: int
    description: str
    quantity: Decimal
    unit_price: Decimal
    amount: Decimal
    taxable: bool


class InvoiceIn(BaseModel):
    company_id: int
    invoice_no: str | None = Field(default=None, max_length=30)
    # Empty = the company's default currency.
    currency_code: str | None = Field(default=None, max_length=3)
    customer_id: int | None = None
    save_customer: bool = True
    invoice_date: date
    due_date: date | None = None

    customer_name: str = Field(min_length=1, max_length=150)
    customer_ntn_cnic: str | None = Field(default=None, max_length=50)
    customer_phone: str | None = Field(default=None, max_length=50)
    customer_email: str | None = None
    customer_address: str = Field(min_length=1)
    customer_city: str | None = None
    customer_county: str | None = None
    customer_country: str | None = None
    customer_postal_code: str | None = None

    items: list[InvoiceItemIn] = Field(min_length=1)
    discount: Decimal = Field(default=Decimal(0), ge=0)
    tax_rate: Decimal = Field(default=Decimal(0), ge=0, le=100)
    notes: str | None = None

    @field_validator("currency_code", mode="before")
    @classmethod
    def _currency(cls, v):
        from .currencies import CURRENCIES

        if v is None or str(v).strip() == "":
            return None
        code = str(v).strip().upper()
        if code not in CURRENCIES:
            raise ValueError(f"Currency must be one of {', '.join(CURRENCIES)}")
        return code

    _s = field_validator(
        "customer_name", "customer_ntn_cnic", "customer_phone", "customer_email",
        "customer_address", "customer_city", "customer_county", "customer_country", "customer_postal_code",
        mode="before",
    )(_strip)


class PaymentIn(BaseModel):
    payment_date: date
    amount: Decimal = Field(gt=0)
    method: PaymentMethod = "cash"
    reference: str | None = None
    notes: str | None = None


class PaymentOut(ORM):
    id: int
    payment_date: date
    amount: Decimal
    method: PaymentMethod
    reference: str | None
    notes: str | None


class InvoiceSummary(ORM):
    id: int
    company_id: int
    company_name: str
    company_code: str
    currency_code: str
    currency_symbol: str
    currency_name: str
    currency_decimals: int
    invoice_no: str
    invoice_date: date
    due_date: date | None
    customer_name: str
    customer_phone: str | None
    net_amount: Decimal
    vat_amount: Decimal
    total: Decimal
    amount_paid: Decimal
    balance: Decimal
    status: InvoiceStatus
    overdue: bool


class InvoiceOut(InvoiceSummary):
    customer_id: int | None
    customer_ntn_cnic: str | None
    customer_email: str | None
    customer_address: str
    customer_city: str | None
    customer_county: str | None
    customer_country: str | None
    customer_postal_code: str | None
    subtotal: Decimal
    taxable_total: Decimal
    non_taxable_total: Decimal
    discount: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    notes: str | None
    created_by_name: str | None
    created_at: datetime | None
    items: list[InvoiceItemOut]
    payments: list[PaymentOut]
    company: CompanyOut


class InvoicePage(BaseModel):
    items: list[InvoiceSummary]
    total: int
    page: int
    page_size: int
