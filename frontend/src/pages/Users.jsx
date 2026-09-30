import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import Icon from '../components/Icon'
import { Alert, Field, Modal, Spinner } from '../components/ui'
import { fmtDate } from '../format'

function UserModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    username: user?.username || '',
    full_name: user?.full_name || '',
    role: user?.role || 'staff',
    password: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (user) {
        await api.put(`/users/${user.id}`, {
          full_name: form.full_name,
          role: form.role,
          ...(form.password ? { password: form.password } : {}),
        })
      } else {
        await api.post('/users', form)
      }
      onSaved()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={user ? `Edit ${user.username}` : 'New user'} onClose={onClose}>
      <form onSubmit={submit}>
        <Alert>{error}</Alert>
        <div className="grid-1">
          <Field label="Username" required>
            <input value={form.username} onChange={set('username')} disabled={!!user} minLength={3} required />
          </Field>
          <Field label="Full name" required>
            <input value={form.full_name} onChange={set('full_name')} required />
          </Field>
          <Field label="Role" required hint="Staff can create invoices and take payments. Admins can also cancel invoices, delete payments and manage company settings and users.">
            <select value={form.role} onChange={set('role')}>
              <option value="staff">Staff</option>
              <option value="super_admin">Admin</option>
            </select>
          </Field>
          <Field label={user ? 'New password (leave empty to keep)' : 'Password'} required={!user}>
            <input type="password" value={form.password} onChange={set('password')} minLength={6} required={!user} />
          </Field>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function Users() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(undefined)

  const load = useCallback(() => {
    api.get('/users').then(setUsers).catch((e) => setError(e.message))
  }, [])
  useEffect(load, [load])

  const toggle = async (u) => {
    setError('')
    try {
      await api.put(`/users/${u.id}`, { is_active: !u.is_active })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  const remove = async (u) => {
    if (!window.confirm(`Delete user "${u.full_name}" (${u.username})? They will no longer be able to sign in. Their invoices are kept.`)) return
    setError('')
    try {
      await api.del(`/users/${u.id}`)
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Users</h1>
          <p className="muted">People who can sign in to the invoice system.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing(null)}>
          <Icon name="plus" /> New user
        </button>
      </div>
      <Alert>{error}</Alert>
      <section className="card flush">
        {!users ? (
          <Spinner />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="hide-sm">Username</th>
                  <th>Role</th>
                  <th className="hide-sm">Status</th>
                  <th className="hide-md">Added</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.full_name}</strong>{u.id === me.id && <span className="pill">You</span>}
                      <small className="muted show-sm-block">{u.username}{!u.is_active && ' · Disabled'}</small>
                    </td>
                    <td className="mono hide-sm">{u.username}</td>
                    <td>{u.role === 'super_admin' ? 'Admin' : 'Staff'}</td>
                    <td className="hide-sm">
                      <span className={`badge ${u.is_active ? 'badge-paid' : 'badge-cancelled'}`}>
                        {u.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="hide-md">{fmtDate(u.created_at)}</td>
                    <td className="row-actions">
                      <button type="button" className="icon-btn" onClick={() => setEditing(u)} aria-label="Edit">
                        <Icon name="edit" size={16} />
                      </button>
                      {u.id !== me.id && (
                        <>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggle(u)}>
                            {u.is_active ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            className="icon-btn danger"
                            onClick={() => remove(u)}
                            aria-label={`Delete ${u.username}`}
                            title="Delete user"
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </>
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
        <UserModal
          user={editing}
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
