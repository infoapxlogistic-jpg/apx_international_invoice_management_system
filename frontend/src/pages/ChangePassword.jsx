import { useState } from 'react'
import { api } from '../api'
import { Alert, Field } from '../components/ui'

export default function ChangePassword() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [msg, setMsg] = useState({ kind: '', text: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    if (form.new_password !== form.confirm) {
      setMsg({ kind: 'error', text: 'The new passwords do not match' })
      return
    }
    setBusy(true)
    try {
      await api.post('/auth/change-password', {
        current_password: form.current_password,
        new_password: form.new_password,
      })
      setForm({ current_password: '', new_password: '', confirm: '' })
      setMsg({ kind: 'success', text: 'Password changed.' })
    } catch (err) {
      setMsg({ kind: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Change Password</h1>
          <p className="muted">Use at least 6 characters.</p>
        </div>
      </div>
      <form className="card narrow" onSubmit={submit}>
        <Alert kind={msg.kind}>{msg.text}</Alert>
        <Field label="Current password" required>
          <input type="password" value={form.current_password} onChange={set('current_password')} required />
        </Field>
        <Field label="New password" required>
          <input type="password" value={form.new_password} onChange={set('new_password')} minLength={6} required />
        </Field>
        <Field label="Confirm new password" required>
          <input type="password" value={form.confirm} onChange={set('confirm')} minLength={6} required />
        </Field>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </>
  )
}
