import { Fragment, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, qs } from '../api'
import { useCompanies } from '../companies'
import Icon from '../components/Icon'
import { Alert, Empty, NewInvoiceButtons, Spinner } from '../components/ui'
import { roundTo } from '../calc'
import { fmtDate, money, monthLabel, monthRange } from '../format'

const FILTER_KEYS = ['company_id', 'q', 'date_from', 'date_to', 'customer_id']
const LIMIT = 500


// Totals are kept per currency; pounds and dollars are never added together.
function addTo(sums, inv) {
  const s = (sums[inv.currency_code] ||= {
    code: inv.currency_code, sym: inv.currency_symbol, dec: inv.currency_decimals, net: 0, vat: 0, total: 0,
  })
  s.net = roundTo(s.net + Number(inv.net_amount), s.dec)
  s.vat = roundTo(s.vat + Number(inv.vat_amount), s.dec)
  s.total = roundTo(s.total + Number(inv.total), s.dec)
}

function groupByMonth(items) {
  const groups = []
  for (const inv of items) {
    const key = inv.invoice_date.slice(0, 7)
    let g = groups[groups.length - 1]
    if (!g || g.key !== key) {
      g = { key, items: [], sums: {} }
      groups.push(g)
    }
    g.items.push(inv)
    addTo(g.sums, inv)
  }
  return groups
}

// "£10,000.00 · $2,500.00"
function sumText(sums, field) {
  return Object.values(sums)
    .map((s) => money(s[field], s.sym, s.dec))
    .join(' · ')
}

export default function Invoices() {
  const [params, setParams] = useSearchParams()
  const { companies, multi } = useCompanies()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState(params.get('q') || '')
  const navigate = useNavigate()

  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']))
  const key = params.toString()
  // The month picker shows a month when the date range is exactly one calendar month.
  const pickedMonth =
    filters.date_from && monthRange(filters.date_from.slice(0, 7)).to === filters.date_to && filters.date_from.endsWith('-01')
      ? filters.date_from.slice(0, 7)
      : ''

  useEffect(() => {
    setData(null)
    api
      .get(`/invoices${qs({ ...filters, page: 1, page_size: LIMIT })}`)
      .then(setData)
      .catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('q') || '') !== search) update({ q: search })
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  function update(changes) {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next, { replace: true })
  }

  const pickMonth = (month) => {
    if (!month) return update({ date_from: '', date_to: '' })
    const { from, to } = monthRange(month)
    update({ date_from: from, date_to: to })
  }

  const hasFilters = FILTER_KEYS.some((k) => filters[k])
  const groups = data ? groupByMonth(data.items) : []
  const grand = {}
  data?.items.forEach((inv) => addTo(grand, inv))

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Invoices</h1>
          <p className="muted">
            {data
              ? `${data.total} invoice${data.total === 1 ? '' : 's'}${data.total ? ` · ${sumText(grand, 'total')}` : ''}`
              : 'Loading…'}
          </p>
        </div>
        <NewInvoiceButtons />
      </div>

      <div className="card filters">
        <div className="search">
          <Icon name="search" />
          <input
            placeholder="Search invoice #, customer or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {multi && (
          <select value={filters.company_id} onChange={(e) => update({ company_id: e.target.value })}>
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <label className="inline-date">
          Month
          <input type="month" value={pickedMonth} onChange={(e) => pickMonth(e.target.value)} />
        </label>
        {hasFilters && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setSearch('')
              setParams({}, { replace: true })
            }}
          >
            Show all
          </button>
        )}
      </div>

      <Alert>{error}</Alert>

      <section className="card flush">
        {!data ? (
          <Spinner />
        ) : data.items.length === 0 ? (
          <Empty title="No invoices found">
            {hasFilters ? 'Try another month or clear the search.' : 'Create your first invoice.'}
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  {multi && <th className="hide-sm">Company</th>}
                  <th>Customer</th>
                  <th className="hide-sm">Date</th>
                  <th className="num hide-md">Subtotal</th>
                  <th className="num hide-md">VAT</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.key}>
                    <tr className="month-row">
                      <td colSpan={multi ? 3 : 2}>
                        <strong>{monthLabel(g.key)}</strong>
                        <span className="muted"> · {g.items.length} invoice{g.items.length === 1 ? '' : 's'}</span>
                      </td>
                      <td className="hide-sm" />
                      <td className="num hide-md">{sumText(g.sums, 'net')}</td>
                      <td className="num hide-md">{sumText(g.sums, 'vat')}</td>
                      <td className="num"><strong>{sumText(g.sums, 'total')}</strong></td>
                    </tr>
                    {g.items.map((i) => (
                      <tr key={i.id} className="clickable" onClick={() => navigate(`/invoices/${i.id}`)}>
                        <td className="mono">{i.invoice_no}</td>
                        {multi && <td className="hide-sm">{i.company_name}</td>}
                        <td>
                          <div>{i.customer_name}</div>
                          <small className="muted show-sm">{fmtDate(i.invoice_date)}</small>
                        </td>
                        <td className="hide-sm">{fmtDate(i.invoice_date)}</td>
                        <td className="num hide-md">{money(i.net_amount, i.currency_symbol, i.currency_decimals)}</td>
                        <td className="num hide-md">{money(i.vat_amount, i.currency_symbol, i.currency_decimals)}</td>
                        <td className="num">{money(i.total, i.currency_symbol, i.currency_decimals)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > LIMIT && (
          <p className="muted small padded">Showing the latest {LIMIT}. Pick a month to see older invoices.</p>
        )}
      </section>
    </>
  )
}
