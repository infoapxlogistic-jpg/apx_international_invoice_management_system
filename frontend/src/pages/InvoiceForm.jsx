import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, qs } from '../api'
import { findCurrency, useCompanies } from '../companies'
import Icon from '../components/Icon'
import { Alert, CompanyLogo, Field, Spinner } from '../components/ui'
import { invoiceTotals } from '../calc'
import { addDays, money, today } from '../format'

const emptyItem = () => ({ key: Math.random(), description: '', quantity: '1', unit_price: '', taxable: false })

const CUSTOMER_FIELDS = [
  ['customer_name', 'name'],
  ['customer_address', 'address'],
  ['customer_city', 'city'],
  ['customer_county', 'county'],
  ['customer_postal_code', 'postal_code'],
  ['customer_country', 'country'],
  ['customer_phone', 'phone'],
  ['customer_email', 'email'],
  ['customer_ntn_cnic', 'ntn_cnic'],
]

function blankForm(company) {
  const d = today()
  return {
    company_id: company?.id || '',
    invoice_no: '',
    currency_code: company?.currency_code || 'GBP',
    customer_id: null,
    save_customer: true,
    invoice_date: d,
    due_date: company ? addDays(d, company.payment_terms_days ?? 10) : '',
    ...Object.fromEntries(CUSTOMER_FIELDS.map(([k]) => [k, ''])),
    items: [emptyItem()],
    discount: 0,
    tax_rate: company ? String(Number(company.default_tax_rate)) : '20',
    notes: company?.default_description || '',
  }
}

function fromInvoice(inv, { copy }) {
  const d = today()
  return {
    company_id: inv.company_id,
    invoice_no: copy ? '' : inv.invoice_no,
    currency_code: inv.currency_code,
    customer_id: inv.customer_id,
    save_customer: true,
    invoice_date: copy ? d : inv.invoice_date,
    due_date: copy ? addDays(d, inv.company?.payment_terms_days ?? 10) : inv.due_date || '',
    ...Object.fromEntries(CUSTOMER_FIELDS.map(([k]) => [k, inv[k] || ''])),
    items: inv.items.map((i) => ({
      key: Math.random(),
      description: i.description,
      quantity: String(Number(i.quantity)),
      unit_price: String(Number(i.unit_price)),
      taxable: i.taxable,
    })),
    discount: copy ? 0 : Number(inv.discount),
    tax_rate: String(Number(inv.tax_rate)),
    notes: inv.notes || '',
  }
}

function CustomerSearch({ onPick }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const box = useRef(null)

  useEffect(() => {
    if (!q.trim()) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      api.get(`/customers${qs({ q, limit: 8 })}`).then(setResults).catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className="customer-search" ref={box}>
      <div className="search">
        <Icon name="search" />
        <input
          placeholder="Find a saved customer by name or phone"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && results.length > 0 && (
        <ul className="suggest">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(c)
                  setQ('')
                  setOpen(false)
                }}
              >
                <strong>{c.name}</strong>
                <small>{[c.address, c.city, c.postal_code, c.phone].filter(Boolean).join(' · ')}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function InvoiceForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { reload: reloadCompanies, currencies } = useCompanies()
  const editing = !!id
  const copyFrom = params.get('copy')

  const [companies, setCompanies] = useState(null)
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const list = await api.get('/companies')
        if (!alive) return
        setCompanies(list)
        const source = id || copyFrom
        if (source) {
          const inv = await api.get(`/invoices/${source}`)
          if (!alive) return
          if (editing && inv.status === 'cancelled') {
            navigate(`/invoices/${id}`, { replace: true })
            return
          }
          setForm(fromInvoice(inv, { copy: !editing }))
        } else {
          const code = (params.get('company') || '').toUpperCase()
          setForm(blankForm(list.find((c) => c.code === code) || list[0]))
        }
      } catch (e) {
        setError(e.message)
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, copyFrom, params.get('company')])

  const company = companies?.find((c) => c.id === Number(form?.company_id))
  const currency = findCurrency(currencies, form?.currency_code || company?.currency_code)
  const sym = currency.symbol
  const dec = currency.decimals

  const totals = useMemo(
    () => (form ? invoiceTotals(form.items, form.tax_rate, form.discount, dec) : null),
    [form, dec],
  )

  if (error && !form) return <Alert>{error}</Alert>
  if (!form || !companies) return <Spinner />

  const set = (k) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => {
      const next = { ...f, [k]: value }
      // Typing over a picked customer's details makes this a one-off customer on the invoice.
      if (k.startsWith('customer_') && f.customer_id) next.customer_id = null
      return next
    })
  }

  const setItem = (idx, k, v) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, [k]: v } : it)) }))

  const pickCustomer = (c) =>
    setForm((f) => ({
      ...f,
      customer_id: c.id,
      ...Object.fromEntries(CUSTOMER_FIELDS.map(([k, src]) => [k, c[src] || ''])),
    }))

  const switchCompany = (c) =>
    setForm((f) => ({
      ...f,
      company_id: c.id,
      tax_rate: String(Number(c.default_tax_rate)),
      currency_code: c.currency_code || 'GBP',
    }))

  const autoNumber = company ? `${company.invoice_prefix}${company.next_invoice_number}` : ''

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const items = form.items.filter((i) => i.description.trim() || Number(i.unit_price))
    if (items.length === 0) {
      setError('Add at least one line with a description and amount')
      return
    }
    if (items.some((i) => !i.description.trim())) {
      setError('Every line with an amount needs a description')
      return
    }
    const blankToNull = (v) => (typeof v === 'string' && v.trim() === '' ? null : v)
    const body = {
      ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, blankToNull(v)])),
      company_id: Number(form.company_id),
      customer_name: form.customer_name,
      customer_address: form.customer_address,
      invoice_date: form.invoice_date,
      save_customer: form.save_customer,
      customer_id: form.customer_id,
      discount: Number(form.discount) || 0,
      tax_rate: Number(form.tax_rate) || 0,
      items: items.map((i) => ({
        description: i.description.trim(),
        quantity: Number(i.quantity) || 1,
        unit_price: Number(i.unit_price) || 0,
        taxable: i.taxable,
      })),
    }
    setBusy(true)
    try {
      const saved = editing ? await api.put(`/invoices/${id}`, body) : await api.post('/invoices', body)
      reloadCompanies()
      navigate(`/invoices/${saved.id}`, { replace: true })
    } catch (err) {
      setError(err.message)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="invoice-form" style={{ '--brand': company?.brand_color }}>
      <div className="page-head">
        <div>
          <Link to={editing ? `/invoices/${id}` : '/invoices'} className="back">
            <Icon name="back" size={16} /> Back
          </Link>
          <h1>
            {editing ? `Edit invoice ${form.invoice_no}` : 'Create invoice for '}
            {!editing && <span className="brand-text">{company?.name}</span>}
          </h1>
        </div>
        {!editing && companies.length > 1 && (
          <div className="seg big">
            {companies.map((c) => (
              <button
                type="button"
                key={c.id}
                className={c.id === Number(form.company_id) ? 'on' : ''}
                style={{ '--brand': c.brand_color }}
                onClick={() => switchCompany(c)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <Alert>{error}</Alert>

      <div className="form-grid">
        <section className="card">
          <div className="card-head">
            <h3>Bill to</h3>
            {form.customer_id && <span className="pill">Saved customer</span>}
          </div>
          <CustomerSearch onPick={pickCustomer} />
          <div className="grid-2">
            <Field label="Customer / company name" required className="span-2">
              <input value={form.customer_name} onChange={set('customer_name')} required />
            </Field>
            <Field label="Address" required className="span-2" hint="Street and unit, e.g. Unit A10, 42 Fox Street">
              <textarea rows={2} value={form.customer_address} onChange={set('customer_address')} required />
            </Field>
            <Field label="City / Town">
              <input value={form.customer_city} onChange={set('customer_city')} />
            </Field>
            <Field label="County">
              <input value={form.customer_county} onChange={set('customer_county')} placeholder="e.g. Greater Manchester" />
            </Field>
            <Field label="Postcode">
              <input value={form.customer_postal_code} onChange={set('customer_postal_code')} />
            </Field>
            <Field label="Country">
              <input value={form.customer_country} onChange={set('customer_country')} placeholder="United Kingdom" />
            </Field>
            <Field label="Phone #">
              <input value={form.customer_phone} onChange={set('customer_phone')} />
            </Field>
            <Field label="Email">
              <input type="email" value={form.customer_email} onChange={set('customer_email')} />
            </Field>
            <Field label="VAT / Company reg. no.">
              <input value={form.customer_ntn_cnic} onChange={set('customer_ntn_cnic')} />
            </Field>
          </div>
          {!form.customer_id && (
            <label className="check">
              <input type="checkbox" checked={form.save_customer} onChange={set('save_customer')} />
              Save this customer for next time
            </label>
          )}
        </section>

        <section className="card side">
          <CompanyLogo company={company} />
          <div className="grid-1">
            <Field label="Invoice number" hint={editing ? 'You can change it; it must not be used by another invoice' : 'Leave empty to use the next number automatically'}>
              <input value={form.invoice_no} onChange={set('invoice_no')} placeholder={editing ? '' : `${autoNumber} (automatic)`} required={editing} />
            </Field>
            <Field label="Currency" hint="Amounts are entered in this currency. Nothing is converted.">
              <select value={form.currency_code} onChange={set('currency_code')}>
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.symbol.trim()} · {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Invoice date" required>
              <input type="date" value={form.invoice_date} onChange={set('invoice_date')} required />
            </Field>
            <Field label="Due date" hint={`Set to ${company?.payment_terms_days ?? 10} days after the invoice date; change if needed`}>
              <input type="date" value={form.due_date || ''} min={form.invoice_date} onChange={set('due_date')} />
            </Field>
            <div className="quick-due">
              {[10, 14, 30].map((d) => (
                <button
                  type="button"
                  key={d}
                  className="chip"
                  onClick={() => setForm((f) => ({ ...f, due_date: addDays(f.invoice_date, d) }))}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h3>Items</h3>
          <span className="muted">Tick VAT on lines that are taxable ({Number(form.tax_rate) || 0}%)</span>
        </div>
        <div className="items">
          <div className="items-head simple">
            <span>#</span>
            <span>Description</span>
            <span className="num">Qty</span>
            <span className="num">Unit price ({currency.code})</span>
            <span className="center">VAT</span>
            <span className="num">Total</span>
            <span />
          </div>
          {form.items.map((it, idx) => (
            <div className="item-row simple" key={it.key}>
              <span className="sno">{idx + 1}</span>
              <textarea
                rows={1}
                placeholder="e.g. Cargo Charges"
                value={it.description}
                onChange={(e) => setItem(idx, 'description', e.target.value)}
              />
              <input
                className="num qty"
                type="number"
                min="0.01"
                step="any"
                value={it.quantity}
                onChange={(e) => setItem(idx, 'quantity', e.target.value)}
                aria-label="Quantity"
              />
              <input
                className="num price"
                type="number"
                min="0"
                step={dec ? '0.01' : '1'}
                placeholder={dec ? '0.00' : '0'}
                value={it.unit_price}
                onChange={(e) => setItem(idx, 'unit_price', e.target.value)}
                aria-label="Unit price"
              />
              <label className="vat-toggle" title="Charge VAT on this line">
                <input type="checkbox" checked={it.taxable} onChange={(e) => setItem(idx, 'taxable', e.target.checked)} />
                <span>VAT</span>
              </label>
              <span className="num line-total">{money(totals.amounts[idx], sym, dec)}</span>
              <button
                type="button"
                className="icon-btn danger"
                disabled={form.items.length === 1}
                onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                aria-label="Remove line"
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-ghost add-line"
            onClick={() => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }))}
          >
            <Icon name="plus" /> Add line
          </button>
        </div>

        <div className="totals-area">
          <Field
            label="Invoice description (optional)"
            className="notes"
            hint="Leave empty if not needed. The grey text is only an example and is not printed."
          >
            <textarea
              rows={9}
              value={form.notes}
              onChange={set('notes')}
              placeholder={'e.g.\nActing as agent on behalf of:\n\nCompany name\nAddress\nVAT Number: …\n\nPlease pay directly into … account.'}
            />
          </Field>
          <div className="totals">
            <div><span>Subtotal</span><strong>{money(totals.net, sym, dec)}</strong></div>
            {totals.discount > 0 && <div><span>Discount</span><strong>-{money(totals.discount, sym, dec)}</strong></div>}
            <div>
              <span>VAT rate (%)</span>
              <input type="number" min="0" max="100" step="0.01" className="num" value={form.tax_rate} onChange={set('tax_rate')} />
            </div>
            <div><span>Tax</span><strong>{money(totals.vat, sym, dec)}</strong></div>
            <div className="grand"><span>Total</span><strong>{money(totals.gross, sym, dec)}</strong></div>
          </div>
        </div>
      </section>

      <div className="form-actions">
        <button type="button" className="btn" onClick={() => navigate(-1)}>Cancel</button>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Save invoice'}
        </button>
      </div>
    </form>
  )
}
