import { useEffect, useState } from 'react'
import { api } from '../api'
import { useCompanies } from '../companies'
import Icon from '../components/Icon'
import { Alert, CompanyLogo, Field, Spinner } from '../components/ui'

const FIELDS = [
  'name', 'tagline', 'address', 'phone', 'email', 'website', 'ntn', 'vat_number', 'currency_code',
  'currency_symbol', 'currency_name', 'date_format', 'invoice_prefix', 'next_invoice_number',
  'default_tax_rate', 'bank_details', 'payment_note', 'default_description', 'terms', 'brand_color',
  'payment_terms_days', 'pay_online_url', 'bank_name', 'account_holder', 'account_number', 'sort_code', 'bic', 'iban',
]

function CompanyCard({ company, onChange }) {
  const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map((k) => [k, company[k] ?? ''])))
  const [msg, setMsg] = useState({ kind: '', text: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg({})
    const body = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v === '' ? null : v]),
    )
    body.default_tax_rate = Number(form.default_tax_rate) || 0
    body.next_invoice_number = Number(form.next_invoice_number) || 1
    body.payment_terms_days = Number(form.payment_terms_days) || 0
    try {
      onChange(await api.put(`/companies/${company.id}`, body))
      setMsg({ kind: 'success', text: 'Company details saved.' })
    } catch (err) {
      setMsg({ kind: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  const upload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      onChange(await api.upload(`/companies/${company.id}/logo`, file))
      setMsg({ kind: 'success', text: 'Logo updated.' })
    } catch (err) {
      setMsg({ kind: 'error', text: err.message })
    }
  }

  const removeLogo = async () => {
    try {
      onChange(await api.del(`/companies/${company.id}/logo`))
    } catch (err) {
      setMsg({ kind: 'error', text: err.message })
    }
  }

  return (
    <form className="card" onSubmit={save} style={{ '--brand': form.brand_color }}>
      <div className="card-head">
        <h3>{company.name}</h3>
        <span className="muted">Next invoice: {form.invoice_prefix}{form.next_invoice_number}</span>
      </div>
      <Alert kind={msg.kind}>{msg.text}</Alert>

      <div className="logo-row">
        <CompanyLogo company={company} size="lg" />
        <div className="logo-actions">
          <label className="btn">
            Upload logo
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={upload} />
          </label>
          {company.logo_url && (
            <button type="button" className="btn btn-ghost" onClick={removeLogo}>Remove</button>
          )}
          <small className="muted">PNG, JPG, WEBP or SVG, up to 2 MB. Shown on printed invoices.</small>
        </div>
      </div>

      <div className="grid-2">
        <Field label="Company name" required><input value={form.name} onChange={set('name')} required /></Field>
        <Field label="Tagline"><input value={form.tagline} onChange={set('tagline')} /></Field>
        <Field label="Address" className="span-2"><textarea rows={2} value={form.address} onChange={set('address')} /></Field>
        <Field label="Phone"><input value={form.phone} onChange={set('phone')} /></Field>
        <Field label="Email"><input value={form.email} onChange={set('email')} /></Field>
        <Field label="Website"><input value={form.website} onChange={set('website')} /></Field>
        <Field label="Company no."><input value={form.ntn} onChange={set('ntn')} /></Field>
        <Field label="GB VAT number"><input value={form.vat_number} onChange={set('vat_number')} /></Field>
        <Field label="Currency code" required hint="e.g. GBP, PKR, USD">
          <input value={form.currency_code} onChange={set('currency_code')} maxLength={3} required />
        </Field>
        <Field label="Currency symbol" required hint="e.g. £, Rs, $">
          <input value={form.currency_symbol} onChange={set('currency_symbol')} maxLength={5} required />
        </Field>
        <Field label="Currency name" hint="Printed next to Gross, e.g. GBP Pound Sterling">
          <input value={form.currency_name} onChange={set('currency_name')} />
        </Field>
        <Field label="Date format on invoice">
          <select value={form.date_format} onChange={set('date_format')}>
            <option value="DD MMM YYYY">DD MMM YYYY (25 Sep 2026)</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY (07/28/2026)</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY (28/07/2026)</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD (2026-07-28)</option>
          </select>
        </Field>
        <Field label="Invoice prefix" required hint="e.g. AP gives AP10001">
          <input value={form.invoice_prefix} onChange={set('invoice_prefix')} maxLength={10} required />
        </Field>
        <Field label="Next invoice number" required hint="Numbers already used are skipped automatically">
          <input type="number" min="1" step="1" value={form.next_invoice_number} onChange={set('next_invoice_number')} required />
        </Field>
        <Field label="Default VAT %">
          <input type="number" min="0" max="100" step="0.01" value={form.default_tax_rate} onChange={set('default_tax_rate')} />
        </Field>
        <Field label="Brand colour">
          <input type="color" value={form.brand_color} onChange={set('brand_color')} />
        </Field>
        <h4 className="form-section span-2">Payment details (printed on every invoice)</h4>
        <Field label="Bank name"><input value={form.bank_name} onChange={set('bank_name')} placeholder="e.g. Monzo" /></Field>
        <Field label="Account holder"><input value={form.account_holder} onChange={set('account_holder')} /></Field>
        <Field label="Account number"><input value={form.account_number} onChange={set('account_number')} /></Field>
        <Field label="Sort code"><input value={form.sort_code} onChange={set('sort_code')} placeholder="00-00-00" /></Field>
        <Field label="BIC"><input value={form.bic} onChange={set('bic')} /></Field>
        <Field label="IBAN"><input value={form.iban} onChange={set('iban')} /></Field>
        <Field label="Payment terms (days)" hint="Due date = invoice date + this many days">
          <input type="number" min="0" max="365" step="1" value={form.payment_terms_days} onChange={set('payment_terms_days')} />
        </Field>
        <Field label="'Pay invoice online' link" hint="Optional. Shows a Pay button on the invoice">
          <input type="url" value={form.pay_online_url} onChange={set('pay_online_url')} placeholder="https://" />
        </Field>
        <Field label="Other payment info" className="span-2" hint="Optional extra lines under the bank details">
          <textarea rows={2} value={form.bank_details} onChange={set('bank_details')} />
        </Field>
        <h4 className="form-section span-2">Invoice text</h4>
        <Field label="Default invoice description" className="span-2" hint="Filled in on every new invoice; can be changed per invoice">
          <textarea rows={7} value={form.default_description} onChange={set('default_description')} />
        </Field>
        <Field label="Extra note (optional)" className="span-2" hint="Printed at the very bottom of the invoice">
          <textarea rows={3} value={form.payment_note} onChange={set('payment_note')} />
        </Field>
        <Field label="Terms and Conditions" className="span-2" hint="Printed under 'Terms and Conditions'">
          <textarea rows={3} value={form.terms} onChange={set('terms')} />
        </Field>
      </div>
      <div className="form-actions save-row">
        {msg.text && (
          <span className={`save-msg ${msg.kind}`} role="status">
            <Icon name={msg.kind === 'error' ? 'alert' : 'check'} size={16} />
            {msg.text}
          </span>
        )}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save company'}</button>
      </div>
    </form>
  )
}

export default function Companies() {
  const [companies, setCompanies] = useState(null)
  const [error, setError] = useState('')
  const { reload } = useCompanies()

  useEffect(() => {
    api.get('/companies').then(setCompanies).catch((e) => setError(e.message))
  }, [])

  if (error) return <Alert>{error}</Alert>
  if (!companies) return <Spinner />

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{companies.length > 1 ? 'Companies' : 'Company Settings'}</h1>
          <p className="muted">Details printed on invoices.</p>
        </div>
      </div>
      <div className="companies-grid">
        {companies.map((c) => (
          <CompanyCard
            key={c.id}
            company={c}
            onChange={(updated) => {
              setCompanies((list) => list.map((x) => (x.id === updated.id ? updated : x)))
              reload()
            }}
          />
        ))}
      </div>
    </>
  )
}
