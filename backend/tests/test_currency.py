"""Each invoice can be in its own currency; amounts are entered in it, never converted or mixed."""
from decimal import Decimal

D = Decimal


def _post(client, auth, company_id, items, currency=None, date="2026-09-25", tax_rate=20):
    body = {
        "company_id": company_id, "invoice_date": date, "customer_name": "Currency Test",
        "customer_address": "1 Road", "tax_rate": tax_rate, "save_customer": False,
        "items": [{"description": d, "quantity": q, "unit_price": p, "taxable": t} for d, q, p, t in items],
    }
    if currency is not None:
        body["currency_code"] = currency
    return client.post("/api/invoices", headers=auth, json=body)


def test_currency_list(client):
    codes = [c["code"] for c in client.get("/api/currencies").json()]
    assert {"GBP", "USD", "EUR", "JPY"} <= set(codes)


def test_default_is_company_currency(client, auth, company_id):
    inv = _post(client, auth, company_id, [("A", 1, 10, False)]).json()
    assert (inv["currency_code"], inv["currency_symbol"]) == ("GBP", "£")


def test_usd_and_eur_invoices(client, auth, company_id):
    usd = _post(client, auth, company_id, [("Freight", 1, 9520, False), ("Fee", 1, 400, True)], currency="usd").json()
    assert (usd["currency_code"], usd["currency_symbol"], usd["currency_decimals"]) == ("USD", "$", 2)
    assert D(usd["total"]) == D("10000.00")
    eur = _post(client, auth, company_id, [("Fee", 1, 33.33, True)], currency="EUR").json()
    assert eur["currency_symbol"] == "€"
    assert D(eur["tax_amount"]) == D("6.67")


def test_yen_has_no_decimals(client, auth, company_id):
    inv = _post(client, auth, company_id, [("Freight", 1, 1499.5, False), ("Fee", 3, 333.4, True)], currency="JPY").json()
    assert inv["currency_decimals"] == 0
    amounts = [D(i["amount"]) for i in inv["items"]]
    assert amounts == [D("1500"), D("1000")]            # 1499.5 -> 1500, 3 x 333.4 = 1000.2 -> 1000
    assert D(inv["tax_amount"]) == D("200")             # 20% of 1000
    assert D(inv["total"]) == D("2700")


def test_unknown_currency_is_refused(client, auth, company_id):
    assert _post(client, auth, company_id, [("A", 1, 1, False)], currency="XYZ").status_code == 422


def test_edit_can_change_currency(client, auth, company_id):
    inv = _post(client, auth, company_id, [("A", 1, 100, True)]).json()
    body = {
        "company_id": company_id, "invoice_no": inv["invoice_no"], "invoice_date": inv["invoice_date"],
        "customer_name": "Currency Test", "customer_address": "1 Road", "tax_rate": 20, "currency_code": "USD",
        "items": [{"description": "A", "quantity": 1, "unit_price": 100, "taxable": True}],
    }
    edited = client.put(f"/api/invoices/{inv['id']}", headers=auth, json=body).json()
    assert (edited["currency_code"], D(edited["total"])) == ("USD", D("120.00"))


def test_monthly_record_keeps_currencies_apart(client, auth, company_id):
    _post(client, auth, company_id, [("A", 1, 100, False)], currency="GBP", date="2024-02-10")
    _post(client, auth, company_id, [("B", 1, 50, False)], currency="USD", date="2024-02-11")
    _post(client, auth, company_id, [("C", 1, 5000, False)], currency="JPY", date="2024-02-12")
    company = next(c for c in client.get("/api/dashboard", headers=auth).json()["companies"]
                   if c["company_id"] == company_id)
    feb = {m["currency_code"]: D(str(m["total"])) for m in company["monthly"] if m["month"] == "2024-02"}
    assert feb == {"GBP": D("100"), "USD": D("50"), "JPY": D("5000")}
    # The company's own currency is listed first.
    assert [m["currency_code"] for m in company["monthly"] if m["month"] == "2024-02"][0] == "GBP"
