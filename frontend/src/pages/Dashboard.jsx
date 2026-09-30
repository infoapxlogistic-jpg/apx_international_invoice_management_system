import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { Alert, Empty, NewInvoiceButtons, Spinner } from '../components/ui'
import { fmtDate, money, monthLabel, monthRange } from '../format'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/dashboard').then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) return <Alert>{error}</Alert>
  if (!data) return <Spinner />

  const multi = data.companies.length > 1
  const openMonth = (month, companyId) => {
    const { from, to } = monthRange(month)
    navigate(`/invoices?date_from=${from}&date_to=${to}${multi ? `&company_id=${companyId}` : ''}`)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Monthly record of your invoices.</p>
        </div>
        <NewInvoiceButtons />
      </div>

      {data.companies.map((c) => {
        const sym = c.currency_symbol
        return (
          <div key={c.company_id} style={{ '--brand': c.brand_color }}>
            {multi && <h2 className="company-title">{c.company_name}</h2>}
            <div className="stat-row">
              <div className="card stat">
                <small>This month</small>
                <strong>{money(c.this_month_total, sym)}</strong>
                <span className="muted">{c.this_month_count} invoice{c.this_month_count === 1 ? '' : 's'}</span>
              </div>
              <div className="card stat">
                <small>This year</small>
                <strong>{money(c.this_year_total, sym)}</strong>
                <span className="muted">{new Date().getFullYear()}</span>
              </div>
              <div className="card stat">
                <small>All invoices</small>
                <strong>{c.invoice_count}</strong>
                <span className="muted">{money(c.total, sym)} in total</span>
              </div>
            </div>

            <section className="card flush">
              <div className="card-head padded">
                <h3>Monthly record</h3>
                <span className="muted">Click a month to see its invoices</span>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th className="num">Invoices</th>
                      <th className="num hide-sm">Subtotal</th>
                      <th className="num hide-sm">VAT</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.monthly.map((m) => (
                      <tr key={m.month} className="clickable" onClick={() => openMonth(m.month, c.company_id)}>
                        <td><strong>{monthLabel(m.month)}</strong></td>
                        <td className="num">{m.count}</td>
                        <td className="num hide-sm">{money(m.subtotal, sym)}</td>
                        <td className="num hide-sm">{money(m.tax, sym)}</td>
                        <td className="num"><strong>{money(m.total, sym)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )
      })}

      <section className="card flush">
        <div className="card-head padded">
          <h3>Latest invoices</h3>
          <Link to="/invoices" className="link">View all</Link>
        </div>
        {data.recent.length === 0 ? (
          <Empty title="No invoices yet">Create the first invoice using the button above.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  {multi && <th>Company</th>}
                  <th>Customer</th>
                  <th className="hide-sm">Date</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((i) => (
                  <tr key={i.id} className="clickable" onClick={() => navigate(`/invoices/${i.id}`)}>
                    <td className="mono">{i.invoice_no}</td>
                    {multi && <td>{i.company_name}</td>}
                    <td>{i.customer_name}</td>
                    <td className="hide-sm">{fmtDate(i.invoice_date)}</td>
                    <td className="num">{money(i.total, i.currency_symbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
