"""Invoice maths: line totals, VAT only on taxable lines, rounding, discounts, monthly record."""
from decimal import Decimal

import pytest

D = Decimal


def totals(inv):
    keys = ("taxable_total", "non_taxable_total", "subtotal", "tax_amount", "total")
    return {k: D(inv[k]) for k in keys}


def test_client_sample_invoice_12650(make_invoice):
    """The client's own invoice: £9,520 without VAT + £400 with 20% VAT = £10,000."""
    inv = make_invoice([
        ("Cargo Charges Received on behalf of DGL", 1, 9520, False),
        ("Service Charges", 1, 400, True),
    ])
    assert totals(inv) == {
        "taxable_total": D("400.00"),
        "non_taxable_total": D("9520.00"),
        "subtotal": D("9920.00"),
        "tax_amount": D("80.00"),
        "total": D("10000.00"),
    }


def test_no_vat_when_no_line_is_taxable(make_invoice):
    inv = make_invoice([("Cargo Charges", 1, 945, False)])
    t = totals(inv)
    assert t["tax_amount"] == D("0.00")
    assert t["total"] == D("945.00")


def test_all_lines_taxable(make_invoice):
    inv = make_invoice([("A", 1, 100, True), ("B", 1, 50, True)])
    t = totals(inv)
    assert t["taxable_total"] == D("150.00")
    assert t["tax_amount"] == D("30.00")
    assert t["total"] == D("180.00")


def test_quantity_times_unit_price(make_invoice):
    inv = make_invoice([("Boxes", 3, 12.5, False), ("Pallets", 2, 99.99, True)])
    amounts = [D(i["amount"]) for i in inv["items"]]
    assert amounts == [D("37.50"), D("199.98")]
    t = totals(inv)
    assert t["subtotal"] == D("237.48")
    assert t["tax_amount"] == D("40.00")  # 20% of 199.98 = 39.996 -> 40.00
    assert t["total"] == D("277.48")


def test_fractional_quantity(make_invoice):
    inv = make_invoice([("Hours", 2.5, 40, True)])
    assert D(inv["items"][0]["amount"]) == D("100.00")
    assert D(inv["tax_amount"]) == D("20.00")
    assert D(inv["total"]) == D("120.00")


@pytest.mark.parametrize(
    "price, expected_line, expected_vat",
    [
        (10.005, "10.01", "2.00"),   # half a penny rounds up
        (10.004, "10.00", "2.00"),
        (0.125, "0.13", "0.03"),     # VAT 0.026 -> 0.03
        (33.33, "33.33", "6.67"),    # VAT 6.666 -> 6.67
    ],
)
def test_rounding_to_the_penny(make_invoice, price, expected_line, expected_vat):
    inv = make_invoice([("Item", 1, price, True)])
    assert D(inv["items"][0]["amount"]) == D(expected_line)
    assert D(inv["tax_amount"]) == D(expected_vat)
    assert D(inv["total"]) == D(expected_line) + D(expected_vat)


def test_vat_rate_zero(make_invoice):
    inv = make_invoice([("Taxable but 0%", 1, 500, True)], tax_rate=0)
    assert D(inv["tax_amount"]) == D("0.00")
    assert D(inv["total"]) == D("500.00")


def test_other_vat_rate(make_invoice):
    inv = make_invoice([("Reduced rate", 1, 200, True), ("Exempt", 1, 100, False)], tax_rate=5)
    assert D(inv["tax_amount"]) == D("10.00")
    assert D(inv["total"]) == D("310.00")


def test_discount_comes_off_the_taxable_part_first(make_invoice):
    inv = make_invoice([("Taxable", 1, 100, True), ("Exempt", 1, 50, False)], discount=30)
    # taxable 100 - 30 = 70 -> VAT 14; total 150 - 30 + 14
    assert D(inv["tax_amount"]) == D("14.00")
    assert D(inv["total"]) == D("134.00")


def test_discount_bigger_than_subtotal_is_refused(make_invoice):
    make_invoice([("A", 1, 10, False)], discount=11, expect=400)


def test_bad_input_is_refused(make_invoice):
    make_invoice([("Zero qty", 0, 10, False)], expect=422)
    make_invoice([("Negative price", 1, -5, False)], expect=422)
    make_invoice([], expect=422)
    make_invoice([("A", 1, 10, True)], tax_rate=101, expect=422)


def test_editing_recalculates(client, auth, make_invoice, company_id):
    inv = make_invoice([("A", 1, 100, False)])
    assert D(inv["total"]) == D("100.00")
    body = {
        "company_id": company_id,
        "invoice_no": inv["invoice_no"],
        "invoice_date": inv["invoice_date"],
        "customer_name": inv["customer_name"],
        "customer_address": inv["customer_address"],
        "tax_rate": 20,
        "items": [{"description": "A", "quantity": 2, "unit_price": 100, "taxable": True}],
    }
    r = client.put(f"/api/invoices/{inv['id']}", headers=auth, json=body)
    assert r.status_code == 200, r.text
    edited = r.json()
    assert D(edited["subtotal"]) == D("200.00")
    assert D(edited["tax_amount"]) == D("40.00")
    assert D(edited["total"]) == D("240.00")


def test_totals_sent_by_the_browser_are_ignored(client, auth, company_id):
    """The server always works the maths out itself."""
    body = {
        "company_id": company_id, "invoice_date": "2026-09-25", "customer_name": "X", "customer_address": "Y",
        "tax_rate": 20, "total": 1, "tax_amount": 999, "subtotal": 5,
        "items": [{"description": "A", "quantity": 1, "unit_price": 100, "taxable": True}],
    }
    inv = client.post("/api/invoices", headers=auth, json=body).json()
    assert D(inv["total"]) == D("120.00")


def _month_row(client, auth, company_id, month, currency="GBP"):
    companies = client.get("/api/dashboard", headers=auth).json()["companies"]
    company = next(c for c in companies if c["company_id"] == company_id)
    return next(
        (m for m in company["monthly"] if m["month"] == month and m["currency_code"] == currency),
        {"count": 0, "subtotal": 0, "tax": 0, "total": 0},
    )


def test_monthly_record_adds_up(client, auth, make_invoice, company_id):
    old = _month_row(client, auth, company_id, "2025-03")
    make_invoice([("A", 1, 100, True)], invoice_date="2025-03-05")   # 100 + 20
    make_invoice([("B", 1, 945, False)], invoice_date="2025-03-20")  # 945 + 0
    m = _month_row(client, auth, company_id, "2025-03")
    assert m["count"] == old["count"] + 2
    assert D(str(m["subtotal"])) == D(str(old["subtotal"])) + D("1045")
    assert D(str(m["tax"])) == D(str(old["tax"])) + D("20")
    assert D(str(m["total"])) == D(str(old["total"])) + D("1065")

def test_invoice_numbers_go_up_and_never_repeat(make_invoice):
    a = make_invoice([("A", 1, 1, False)])
    b = make_invoice([("B", 1, 1, False)])
    prefix = a["invoice_no"].rstrip("0123456789")
    assert int(b["invoice_no"][len(prefix):]) == int(a["invoice_no"][len(prefix):]) + 1
