"""Mode of payment (bank / cash / card / cheque) and 'payment received' are kept on the invoice."""


def _body(company_id, **extra):
    return {
        "company_id": company_id, "invoice_date": "2026-10-10", "customer_name": "Mode Test",
        "customer_address": "1 Road", "save_customer": False,
        "items": [{"description": "Cargo", "quantity": 1, "unit_price": 505, "taxable": False}],
        **extra,
    }


def test_defaults_to_bank_not_received(client, auth, company_id):
    inv = client.post("/api/invoices", headers=auth, json=_body(company_id)).json()
    assert (inv["payment_mode"], inv["payment_received"]) == ("bank", False)


def test_cash_received_saved_and_editable(client, auth, company_id):
    inv = client.post(
        "/api/invoices", headers=auth, json=_body(company_id, payment_mode="cash", payment_received=True)
    ).json()
    assert (inv["payment_mode"], inv["payment_received"]) == ("cash", True)

    edited = client.put(
        f"/api/invoices/{inv['id']}", headers=auth, json=_body(company_id, payment_mode="cheque")
    ).json()
    assert (edited["payment_mode"], edited["payment_received"]) == ("cheque", False)


def test_unknown_mode_rejected(client, auth, company_id):
    r = client.post("/api/invoices", headers=auth, json=_body(company_id, payment_mode="crypto"))
    assert r.status_code == 422
