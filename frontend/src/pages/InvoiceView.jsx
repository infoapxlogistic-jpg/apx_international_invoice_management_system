import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import Icon from '../components/Icon'
import { Alert, CompanyLogo, Spinner } from '../components/ui'
import { fmtDateAs, money } from '../format'

function lines(text) {
  return (text || '').split('\n').map((l) => l.trim()).filter(Boolean)
}

export function InvoicePaper({ inv }) {
  const c = inv.company
  const sym = inv.currency_symbol
  const cur = c.currency_code
  const dateFmt = c.date_format
  const vatRate = Number(inv.tax_rate)

  const billTo = [
    ...lines(inv.customer_address),
    inv.customer_city,
    inv.customer_county,
    inv.customer_postal_code,
    inv.customer_country,
  ].filter(Boolean)

  const bank = [
    ['Bank name', c.bank_name],
    ['Account holder', c.account_holder],
    ['Account number', c.account_number],
    ['Sort code', c.sort_code],
    ['BIC', c.bic],
    ['IBAN', c.iban],
  ].filter(([, v]) => v)
  const hasPayment = bank.length > 0 || c.bank_details

  return (
    <article className="paper inv2" style={{ '--brand': c.brand_color }}>

      <header className="i2-head">
        <div>
          <h1 className="i2-title">Invoice</h1>
          <table className="i2-meta">
            <tbody>
              <tr><th>Invoice number</th><td>{inv.invoice_no}</td></tr>
              <tr><th>Invoice date</th><td>{fmtDateAs(inv.invoice_date, dateFmt)}</td></tr>
              {inv.due_date && <tr><th>Due date</th><td>{fmtDateAs(inv.due_date, dateFmt)}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="i2-logo">
          <CompanyLogo company={c} size="lg" />
        </div>
      </header>

      <section className="i2-parties">
        <div>
          <h3>Billed to</h3>
          <div>{inv.customer_name}</div>
          {billTo.length > 0 && (
            <div className="i2-gap">
              {billTo.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
          {(inv.customer_phone || inv.customer_email || inv.customer_ntn_cnic) && (
            <div className="i2-gap">
              {inv.customer_email && <div>{inv.customer_email}</div>}
              {inv.customer_phone && <div>Tel: {inv.customer_phone}</div>}
              {inv.customer_ntn_cnic && <div>VAT / Reg. no: {inv.customer_ntn_cnic}</div>}
            </div>
          )}
        </div>
        <div>
          <h3 className="i2-upper">{c.name}</h3>
          {lines(c.address).map((l, i) => <div key={i}>{l}</div>)}
          {(c.email || c.phone || c.website || c.ntn || c.vat_number) && (
            <div className="i2-gap">
              {c.email && <div>{c.email}</div>}
              {c.phone && <div>Tel: {c.phone}</div>}
              {c.website && <div>{c.website}</div>}
              {c.ntn && <div>Company no: {c.ntn}</div>}
              {c.vat_number && <div>GB VAT: {c.vat_number}</div>}
            </div>
          )}
        </div>
      </section>

      {inv.notes && (
        <section className="i2-desc">
          <h4>Invoice description</h4>
          <div className="pre">{inv.notes}</div>
        </section>
      )}

      <table className="i2-items">
        <thead>
          <tr>
            <th>Description</th>
            <th className="num">Qty</th>
            <th className="num">Unit price ({cur})</th>
            <th className="num">Tax</th>
            <th className="num">Total ({cur})</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((it) => (
            <tr key={it.id}>
              <td className="pre">{it.description}</td>
              <td className="num">{Number(it.quantity)}</td>
              <td className="num">{money(it.unit_price, sym)}</td>
              <td className="num">{it.taxable && vatRate > 0 ? `${vatRate}% VAT` : ''}</td>
              <td className="num">{money(it.amount, sym)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="i2-bottom">
        <div className="i2-pay">
          {hasPayment && (
            <>
              <h3>Payment details</h3>
              <table>
                <tbody>
                  {bank.map(([k, v]) => (
                    <tr key={k}><th>{k}:</th><td>{v}</td></tr>
                  ))}
                  <tr><th>Payment reference:</th><td>{inv.invoice_no}</td></tr>
                </tbody>
              </table>
              {c.bank_details && <div className="pre i2-bank-extra">{c.bank_details}</div>}
            </>
          )}
        </div>
        <table className="i2-totals">
          <tbody>
            <tr><th>Subtotal</th><td>{money(Number(inv.subtotal), sym)}</td></tr>
            {Number(inv.discount) > 0 && <tr><th>Discount</th><td>-{money(inv.discount, sym)}</td></tr>}
            <tr><th>Tax</th><td>{money(inv.tax_amount, sym)}</td></tr>
            <tr className="i2-total"><th>Total</th><td>{money(inv.total, sym)}</td></tr>

          </tbody>
        </table>
      </section>

      <section className="i2-due">
        <strong>
          {money(inv.total, sym)} due{inv.due_date ? ` by ${fmtDateAs(inv.due_date, dateFmt)}` : ''}
        </strong>
        {c.pay_online_url && (
          <a className="i2-pay-btn" href={c.pay_online_url} target="_blank" rel="noreferrer">Pay invoice online</a>
        )}
      </section>

      {c.terms && (
        <section className="i2-terms">
          <h3>Terms and Conditions</h3>
          <div className="pre">{c.terms}</div>
        </section>
      )}
      {c.payment_note && <p className="i2-note pre">{c.payment_note}</p>}
    </article>
  )
}

export default function InvoiceView() {
  const { id } = useParams()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [inv, setInv] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(`/invoices/${id}`).then(setInv).catch((e) => setError(e.message))
  }, [id])

  useEffect(() => {
    if (inv) document.title = `${inv.invoice_no} · ${inv.customer_name}`
    return () => {
      document.title = 'Invoice Manager'
    }
  }, [inv])

  const remove = async () => {
    if (!window.confirm(`Delete invoice ${inv.invoice_no}? This cannot be undone.`)) return
    try {
      await api.del(`/invoices/${inv.id}`)
      navigate('/invoices', { replace: true })
    } catch (e) {
      setError(e.message)
    }
  }

  if (error && !inv) return <Alert>{error}</Alert>
  if (!inv) return <Spinner />

  return (
    <>
      <div className="page-head no-print">
        <div>
          <Link to="/invoices" className="back"><Icon name="back" size={16} /> All invoices</Link>
          <h1>{inv.invoice_no}</h1>
          <p className="muted">
            {inv.customer_name} · {money(inv.total, inv.currency_symbol)}
            {inv.created_by_name && ` · created by ${inv.created_by_name}`}
          </p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            <Icon name="print" /> Print / PDF
          </button>
          <Link className="btn" to={`/invoices/${inv.id}/edit`}><Icon name="edit" /> Edit</Link>
          <button type="button" className="btn" onClick={() => navigate(`/invoices/new?copy=${inv.id}`)}>
            <Icon name="copy" /> Duplicate
          </button>
          {isAdmin && (
            <button type="button" className="btn btn-danger-ghost" onClick={remove}>
              <Icon name="trash" /> Delete
            </button>
          )}
        </div>
      </div>

      <div className="no-print"><Alert>{error}</Alert></div>

      <div className="view-single">
        <InvoicePaper inv={inv} />
      </div>
    </>
  )
}