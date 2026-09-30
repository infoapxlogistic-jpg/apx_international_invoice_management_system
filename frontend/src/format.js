export function money(value, symbol = '£') {
  const n = Number(value || 0)
  const s = n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `-${symbol}${s.slice(1)}` : `${symbol}${s}`
}

export function shortMoney(value, symbol = '£') {
  const n = Number(value || 0)
  if (Math.abs(n) >= 1_000_000) return `${symbol}${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 10_000) return `${symbol}${(n / 1000).toFixed(1)}k`
  return money(n, symbol)
}

export function fmtDate(value) {
  if (!value) return '—'
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Date in the company's chosen invoice format, e.g. 07/28/2026 for MM/DD/YYYY.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function fmtDateAs(value, format = 'DD MMM YYYY') {
  if (!value) return ''
  const [y, m, d] = String(value).slice(0, 10).split('-')
  if (format === 'DD MMM YYYY') return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`
  if (format === 'DD/MM/YYYY') return `${d}/${m}/${y}`
  if (format === 'YYYY-MM-DD') return `${y}-${m}-${d}`
  return `${m}/${d}/${y}`
}

// Invoice style amounts: "£ 945" for whole numbers, "£ 945.50" otherwise.
export function invMoney(value, symbol = '£') {
  const n = Number(value || 0)
  const whole = Number.isInteger(round2(n))
  const s = n.toLocaleString('en-GB', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return `${symbol} ${s}`
}

// "2026-09" -> "September 2026"
export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

// "2026-09" -> first and last day of that month, as YYYY-MM-DD
export function monthRange(key) {
  const [y, m] = key.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { from: `${key}-01`, to: `${key}-${String(last).padStart(2, '0')}` }
}

export function today() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

export function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

export const STATUS_LABEL = {
  unpaid: 'Unpaid',
  partial: 'Partially paid',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

export const METHOD_LABEL = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
  card: 'Card',
  other: 'Other',
}
