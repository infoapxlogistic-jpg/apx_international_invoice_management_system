import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { newInvoiceLabel, useCompanies } from '../companies'
import { STATUS_LABEL } from '../format'
import Icon from './Icon'

export function NewInvoiceButtons() {
  const { companies, multi } = useCompanies()
  return (
    <div className="actions">
      {companies.map((c) => (
        <Link
          key={c.id}
          className="btn btn-brand"
          style={{ '--brand': c.brand_color }}
          to={`/invoices/new?company=${c.code}`}
        >
          <Icon name="plus" /> {newInvoiceLabel(c, multi)}
        </Link>
      ))}
    </div>
  )
}

export function StatusBadge({ status, overdue }) {
  if (overdue) return <span className="badge badge-overdue">Overdue</span>
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status] || status}</span>
}

export function CompanyLogo({ company, size = 'md' }) {
  if (!company) return null
  if (company.logo_url) {
    return <img className={`logo logo-${size}`} src={company.logo_url} alt={company.name} />
  }
  return (
    <div className={`logo-text logo-${size}`} style={{ '--brand': company.brand_color }}>
      <span className="logo-mark">{company.name.slice(0, 1)}</span>
      <span>
        <strong>{company.name}</strong>
        {company.tagline && <small>{company.tagline}</small>}
      </span>
    </div>
  )
}

export function Modal({ title, onClose, children, width = 520 }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function Alert({ children, kind = 'error' }) {
  if (!children) return null
  return (
    <div className={`alert alert-${kind}`}>
      <Icon name={kind === 'error' ? 'alert' : 'check'} />
      <span style={{ whiteSpace: 'pre-line' }}>{children}</span>
    </div>
  )
}

export function Field({ label, required, hint, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">
        {label}
        {required && <em className="req">*</em>}
      </span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <Icon name="invoice" size={36} />
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  )
}

export function Spinner() {
  return <div className="spinner" aria-label="Loading" />
}
