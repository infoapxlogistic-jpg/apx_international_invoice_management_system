import time
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Company
from ..schemas import CompanyOut, CompanyUpdate
from ..security import current_user, require_admin

router = APIRouter(prefix="/companies", tags=["companies"])

ALLOWED_LOGO_TYPES = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/svg+xml": ".svg"}
MAX_LOGO_BYTES = 2 * 1024 * 1024


def company_out(c: Company) -> CompanyOut:
    out = CompanyOut.model_validate(c)
    out.logo_url = f"/uploads/{c.logo_path}" if c.logo_path else None
    return out


def active_companies_query():
    return select(Company).where(Company.code.in_(settings.active_company_codes)).order_by(Company.id)


def active_company_ids(db: Session) -> list[int]:
    return [c.id for c in db.scalars(active_companies_query())]


def _get(db: Session, company_id: int) -> Company:
    company = db.get(Company, company_id)
    if company is None or company.code not in settings.active_company_codes:
        raise HTTPException(404, "Company not found")
    return company


@router.get("", response_model=list[CompanyOut], dependencies=[Depends(current_user)])
def list_companies(db: Session = Depends(get_db)):
    return [company_out(c) for c in db.scalars(active_companies_query())]


@router.get("/{company_id}", response_model=CompanyOut, dependencies=[Depends(current_user)])
def get_company(company_id: int, db: Session = Depends(get_db)):
    return company_out(_get(db, company_id))


@router.put("/{company_id}", response_model=CompanyOut, dependencies=[Depends(require_admin)])
def update_company(company_id: int, data: CompanyUpdate, db: Session = Depends(get_db)):
    company = _get(db, company_id)
    values = data.model_dump()
    values["invoice_prefix"] = values["invoice_prefix"].strip().upper()
    values["currency_code"] = values["currency_code"].upper()
    for key, value in values.items():
        setattr(company, key, value)
    db.commit()
    return company_out(company)


@router.post("/{company_id}/logo", response_model=CompanyOut, dependencies=[Depends(require_admin)])
async def upload_logo(company_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    company = _get(db, company_id)
    ext = ALLOWED_LOGO_TYPES.get(file.content_type or "")
    if ext is None:
        raise HTTPException(400, "Logo must be a PNG, JPG, WEBP or SVG image")
    content = await file.read()
    if len(content) > MAX_LOGO_BYTES:
        raise HTTPException(400, "Logo must be smaller than 2 MB")

    name = f"company_{company.id}_{int(time.time())}{ext}"
    (settings.upload_dir / name).write_bytes(content)
    old = company.logo_path
    company.logo_path = name
    db.commit()
    if old:
        Path(settings.upload_dir / old).unlink(missing_ok=True)
    return company_out(company)


@router.delete("/{company_id}/logo", response_model=CompanyOut, dependencies=[Depends(require_admin)])
def delete_logo(company_id: int, db: Session = Depends(get_db)):
    company = _get(db, company_id)
    if company.logo_path:
        Path(settings.upload_dir / company.logo_path).unlink(missing_ok=True)
        company.logo_path = None
        db.commit()
    return company_out(company)
