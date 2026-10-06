"""Currencies an invoice can be issued in. Amounts are entered in that currency; nothing is converted."""
from decimal import ROUND_HALF_UP, Decimal

CURRENCIES = {
    "GBP": {"symbol": "£", "name": "Pound Sterling", "decimals": 2},
    "USD": {"symbol": "$", "name": "US Dollar", "decimals": 2},
    "EUR": {"symbol": "€", "name": "Euro", "decimals": 2},
    "JPY": {"symbol": "¥", "name": "Japanese Yen", "decimals": 0},
    "AED": {"symbol": "AED ", "name": "UAE Dirham", "decimals": 2},
    "CAD": {"symbol": "C$", "name": "Canadian Dollar", "decimals": 2},
    "AUD": {"symbol": "A$", "name": "Australian Dollar", "decimals": 2},
    "PKR": {"symbol": "Rs ", "name": "Pakistani Rupee", "decimals": 2},
}

DEFAULT = "GBP"


def normalise(code: str | None) -> str:
    code = (code or "").strip().upper()
    return code if code in CURRENCIES else DEFAULT


def info(code: str | None) -> dict:
    code = normalise(code)
    return {"code": code, **CURRENCIES[code]}


def round_money(value, code: str | None) -> Decimal:
    """Round to the currency's smallest unit, half up (pence for GBP, whole yen for JPY)."""
    step = Decimal(1).scaleb(-CURRENCIES[normalise(code)]["decimals"])
    return Decimal(value).quantize(step, rounding=ROUND_HALF_UP)
