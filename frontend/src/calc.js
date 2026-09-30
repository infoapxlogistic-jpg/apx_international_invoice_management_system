// Invoice maths shown while typing. Mirrors the server (backend/app/routers/invoices.py),
// which recalculates and saves the real figures.

// Round to the penny, half up (10.005 -> 10.01). Shifting via the exponent avoids float
// errors such as 10.005 * 100 = 1000.4999…
export function round2(n) {
  const v = Number(n) || 0
  return Number(`${Math.round(Number(`${v}e2`))}e-2`)
}

export function invoiceTotals(items, taxRate, discount = 0) {
  const amounts = items.map((i) => round2((Number(i.quantity) || 0) * (Number(i.unit_price) || 0)))
  const taxable = round2(amounts.reduce((sum, a, i) => sum + (items[i].taxable ? a : 0), 0))
  const nonTaxable = round2(amounts.reduce((sum, a, i) => sum + (items[i].taxable ? 0 : a), 0))
  const disc = round2(discount)
  const net = round2(taxable + nonTaxable - disc)
  // VAT only on taxable lines; a discount comes off the taxable part first.
  const vat = round2((Math.max(0, taxable - disc) * (Number(taxRate) || 0)) / 100)
  return { amounts, taxable, nonTaxable, discount: disc, net, vat, gross: round2(net + vat) }
}
