import { useState } from 'react'
import { useAuth } from '../auth'
import Icon from '../components/Icon'
import { Alert, Field } from '../components/ui'

const BRANDS = [
  { letter: 'A', name: 'APXpress Limited', tagline: 'Where we think, this is fast!', color: '#3b4fd8' },
  { letter: 'C', name: 'Creonetix Limited', tagline: 'Design · Market · Thrive', color: '#e11d2e' },
]

const FEATURES = ['Professional invoices ready to print or save as PDF', 'VAT worked out for you', 'Monthly record of every invoice']

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(username, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-art">
        <div className="login-inner">
          <span className="login-kicker">Welcome to</span>
          <h1>Invoice Management System</h1>
          <div className="login-rule" />
          <p>Create, print and keep a monthly record of your invoices, all in one place.</p>

          <ul className="login-features">
            {FEATURES.map((f) => (
              <li key={f}>
                <Icon name="check" size={16} />
                {f}
              </li>
            ))}
          </ul>

          <div className="login-brands">
            {BRANDS.map((b) => (
              <div key={b.name} className="login-brand" style={{ '--brand': b.color }}>
                <span>{b.letter}</span>
                <div>
                  <strong>{b.name}</strong>
                  <small>{b.tagline}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
        <small className="login-copy">© {new Date().getFullYear()} APXpress Limited · Creonetix Limited</small>
      </div>

      <div className="login-side">
        <form className="login-card" onSubmit={submit}>
          <div className="brand-mark lg">
            <Icon name="invoice" size={24} />
          </div>
          <h2>Sign in</h2>
          <p className="muted">Enter your username and password to continue.</p>
          <Alert>{error}</Alert>
          <Field label="Username">
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
          </Field>
          <Field label="Password">
            <div className="password-wrap">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button type="button" className="password-toggle" onClick={() => setShow((s) => !s)}>
                {show ? 'Hide' : 'Show'}
              </button>
            </div>
          </Field>
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
