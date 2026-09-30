// Run with: node src/calc.test.mjs
// Checks that the totals shown while typing an invoice match what the server saves.
import assert from 'node:assert/strict'
import { invoiceTotals } from './calc.js'

const cases = [
  ['client sample 12650', [[1, 9520, false], [1, 400, true]], 20, 0, { net: 9920, vat: 80, gross: 10000 }],
  ['no taxable lines', [[1, 945, false]], 20, 0, { net: 945, vat: 0, gross: 945 }],
  ['all taxable', [[1, 100, true], [1, 50, true]], 20, 0, { net: 150, vat: 30, gross: 180 }],
  ['qty x price', [[3, 12.5, false], [2, 99.99, true]], 20, 0, { net: 237.48, vat: 40, gross: 277.48 }],
  ['fractional qty', [[2.5, 40, true]], 20, 0, { net: 100, vat: 20, gross: 120 }],
  ['half penny rounds up', [[1, 10.005, true]], 20, 0, { net: 10.01, vat: 2, gross: 12.01 }],
  ['just under half', [[1, 10.004, true]], 20, 0, { net: 10, vat: 2, gross: 12 }],
  ['tiny amount', [[1, 0.125, true]], 20, 0, { net: 0.13, vat: 0.03, gross: 0.16 }],
  ['33.33 @20%', [[1, 33.33, true]], 20, 0, { net: 33.33, vat: 6.67, gross: 40 }],
  ['vat rate 0', [[1, 500, true]], 0, 0, { net: 500, vat: 0, gross: 500 }],
  ['vat rate 5', [[1, 200, true], [1, 100, false]], 5, 0, { net: 300, vat: 10, gross: 310 }],
  ['discount off taxable first', [[1, 100, true], [1, 50, false]], 20, 30, { net: 120, vat: 14, gross: 134 }],
]

let failed = 0
for (const [name, lines, rate, discount, want] of cases) {
  const items = lines.map(([quantity, unit_price, taxable]) => ({ quantity, unit_price, taxable }))
  const got = invoiceTotals(items, rate, discount)
  try {
    assert.deepEqual({ net: got.net, vat: got.vat, gross: got.gross }, want)
    console.log(`ok   ${name}`)
  } catch {
    failed++
    console.log(`FAIL ${name}: got ${JSON.stringify({ net: got.net, vat: got.vat, gross: got.gross })}, want ${JSON.stringify(want)}`)
  }
}
console.log(failed ? `\n${failed} failed` : `\nall ${cases.length} passed`)
process.exit(failed ? 1 : 0)
