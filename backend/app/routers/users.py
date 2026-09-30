from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Invoice, Payment, User
from ..schemas import UserCreate, UserOut, UserUpdate
from ..security import hash_password, require_admin

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_admin)])


def _active_admins(db: Session) -> int:
    return db.scalar(
        select(func.count()).select_from(User).where(User.role == "super_admin", User.is_active)
    )


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.scalars(select(User).order_by(User.full_name)).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(data: UserCreate, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.username == data.username)):
        raise HTTPException(400, "This username is already taken")
    user = User(
        username=data.username,
        full_name=data.full_name,
        role=data.role,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int, data: UserUpdate, db: Session = Depends(get_db), me: User = Depends(require_admin)
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")

    losing_admin = user.role == "super_admin" and user.is_active and (
        (data.role is not None and data.role != "super_admin") or data.is_active is False
    )
    if losing_admin and _active_admins(db) <= 1:
        raise HTTPException(400, "At least one active Admin is required")
    if user.id == me.id and data.is_active is False:
        raise HTTPException(400, "You cannot disable your own account")

    if data.full_name is not None:
        user.full_name = data.full_name.strip()
    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.password:
        user.password_hash = hash_password(data.password)
    db.commit()
    return user


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), me: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    if user.id == me.id:
        raise HTTPException(400, "You cannot delete your own account")
    if user.role == "super_admin" and user.is_active and _active_admins(db) <= 1:
        raise HTTPException(400, "At least one active Admin is required")
    # Keep their invoices and payments; only the "created by" link is cleared.
    db.execute(update(Invoice).where(Invoice.created_by_id == user.id).values(created_by_id=None))
    db.execute(update(Payment).where(Payment.created_by_id == user.id).values(created_by_id=None))
    db.delete(user)
    db.commit()
    return {"ok": True}