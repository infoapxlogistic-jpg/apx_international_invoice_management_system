// Invoice maths shown while typing. Mirrors the server (backend/app/routers/invoices.py),
// which recalculates and saves the real figures.

// Round half up to the currency's smallest unit: pennies (decimals = 2) or whole yen (decimals = 0).
// Shifting via the exponent avoids float errors such as 10.005 * 100 = 1000.4999…
export function roundTo(n, decimals = 2) {
  const v = Number(n) || 0
  return Number(`${Math.round(Number(`${v}e${decimals}`))}e-${decimals}`)
}

export const round2 = (n) => roundTo(n, 2)

export function invoiceTotals(items, taxRate, discount = 0, decimals = 2) {
  const r = (n) => roundTo(n, decimals)
  const amounts = items.map((i) => r((Number(i.quantity) || 0) * (Number(i.unit_price) || 0)))
  const taxable = r(amounts.reduce((sum, a, i) => sum + (items[i].taxable ? a : 0), 0))
  const nonTaxable = r(amounts.reduce((sum, a, i) => sum + (items[i].taxable ? 0 : a), 0))
  const disc = r(discount)
  const net = r(taxable + nonTaxable - disc)
  // VAT only on taxable lines; a discount comes off the taxable part first.
  const vat = r((Math.max(0, taxable - disc) * (Number(taxRate) || 0)) / 100)
  return { amounts, taxable, nonTaxable, discount: disc, net, vat, gross: r(net + vat) }
}
