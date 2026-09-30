import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, qs } from '../api'
import { useAuth } from '../auth'
import Icon from '../components/Icon'
import { Alert, Empty, Field, Modal, Spinner } from '../components/ui'
import { money } from '../format'

const BLANK = { name: '', ntn_cnic: '', phone: '', email: '', address: '', city: '', country: '', postal_code: '' }

function CustomerModal({ customer, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    customer ? Object.fromEntries(Object.keys(BLANK).map((k) => [k, customer[k] || ''])) : BLANK,
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v]))
    try {
      await (customer ? api.put(`/customers/${customer.id}`, body) : api.post('/customers', body))
      onSaved()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={customer ? 'Edit customer' : 'New customer'} onClose={onClose} width={620}>
      <form onSubmit={submit}>
        <Alert>{error}</Alert>
        <div className="grid-2">
          <Field label="Name" required className="span-2"><input value={form.name} onChange={set('name')} required /></Field>
          <Field label="Address" required className="span-2"><textarea rows={2} value={form.address} onChange={set('address')} required /></Field>
          <Field label="City / Town"><input value={form.city} onChange={set('city')} /></Field>
          <Field label="Postcode"><input value={form.postal_code} onChange={set('postal_code')} /></Field>
          <Field label="Country"><input value={form.country} onChange={set('country')} /></Field>
          <Field label="Phone #"><input value={form.phone} onChange={set('phone')} /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={set('email')} /></Field>
          <Field label="VAT / Company reg. no."><input value={form.ntn_cnic} onChange={set('ntn_cnic')} /></Field>
        </div>
        {customer && (
          <p className="muted small">Invoices already issued keep the details they were created with.</p>
        )}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function Customers() {
  const { isAdmin } = useAuth()
  const [q, setQ] = useState('')
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(undefined)

  const load = useCallback(() => {
    api.get(`/customers${qs({ q })}`).then(setRows).catch((e) => setError(e.message))
  }, [q])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  const remove = async (c) => {
    if (!window.confirm(`Delete customer ${c.name}?`)) return
    try {
      await api.del(`/customers/${c.id}`)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Customers</h1>
          <p className="muted">Customers are saved when you create invoices, or add them here.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing(null)}>
          <Icon name="plus" /> New customer
        </button>
      </div>
      <div className="card filters">
        <div className="search">
          <Icon name="search" />
          <input placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <Alert>{error}</Alert>
      <section className="card flush">
        {!rows ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty title="No customers found" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>City</th>
                  <th>Postcode</th>
                  <th className="num">Invoices</th>
                  <th className="num">Billed</th>
                  <th className="num">Balance due</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.phone || '—'}</td>
                    <td>{c.city || '—'}</td>
                    <td>{c.postal_code || '—'}</td>
                    <td className="num">
                      <Link className="link" to={`/invoices?customer_id=${c.id}`}>{c.invoice_count}</Link>
                    </td>
                    <td className="num">{money(c.total_billed)}</td>
                    <td className={`num ${Number(c.balance_due) > 0 ? 'neg' : ''}`}>{money(c.balance_due)}</td>
                    <td className="row-actions">
                      <button type="button" className="icon-btn" onClick={() => setEditing(c)} aria-label="Edit">
                        <Icon name="edit" size={16} />
                      </button>
                      {isAdmin && c.invoice_count === 0 && (
                        <button type="button" className="icon-btn danger" onClick={() => remove(c)} aria-label="Delete">
                          <Icon name="trash" size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing !== undefined && (
        <CustomerModal
          customer={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined)
            load()
          }}
        />
      )}
    </>
  )
}
