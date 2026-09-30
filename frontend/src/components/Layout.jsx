import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import { newInvoiceLabel, useCompanies } from '../companies'
import Icon from './Icon'

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  const location = useLocation()
  const role = user.role === 'super_admin' ? 'Admin' : 'Staff'

  useEffect(() => setOpen(false), [location.pathname])
  useEffect(() => {
    if (!open) return
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false)
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div className="user-menu" ref={box}>
      <button
        type="button"
        className={`user-chip ${open ? 'on' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Logged in as ${user.username}`}
      >
        <span className="user-avatar">{user.username.slice(0, 1).toUpperCase()}</span>
        <span className="user-chip-text hide-sm">
          <strong>{user.username}</strong>
          <small>{role}</small>
        </span>
        <Icon name="chevron" size={16} className="user-chevron" />
      </button>
      {open && (
        <div className="user-dropdown" role="menu">
          <div className="user-dropdown-head">
            <span className="user-avatar lg">{user.username.slice(0, 1).toUpperCase()}</span>
            <div>
              <small className="muted">Logged in as</small>
              <strong>{user.full_name}</strong>
              <small className="muted">{user.username} · {role}</small>
            </div>
          </div>
          <Link to="/change-password" className="user-dropdown-item" role="menuitem">
            <Icon name="key" size={16} /> Change Password
          </Link>
          <button type="button" className="user-dropdown-item danger" role="menuitem" onClick={onLogout}>
            <Icon name="logout" size={16} /> Logout
          </button>
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const { user, logout, isAdmin } = useAuth()
  const { companies, multi } = useCompanies()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === '1'
    } catch {
      return false
    }
  })
  const location = useLocation()

  useEffect(() => setOpen(false), [location.pathname])

  // One menu button: on phones/tablets it slides the menu in, on laptops it shrinks the sidebar to icons.
  const toggleMenu = () => {
    if (window.matchMedia('(max-width: 900px)').matches) {
      setOpen(true)
      return
    }
    setCollapsed((c) => {
      try {
        localStorage.setItem('sidebar_collapsed', c ? '0' : '1')
      } catch {
        /* storage unavailable; the choice just won't be remembered */
      }
      return !c
    })
  }

  const links = [
    { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
    { to: '/invoices', label: 'All Invoices', icon: 'invoice', end: true },
    ...companies.map((c) => ({
      to: `/invoices/new?company=${c.code}`,
      label: newInvoiceLabel(c, multi),
      icon: 'plus',
      dot: multi ? c.brand_color : undefined,
    })),
    ...(isAdmin
      ? [
          { to: '/companies', label: multi ? 'Companies' : 'Company Settings', icon: 'company' },
          { to: '/users', label: 'Users', icon: 'users' },
        ]
      : []),
    { to: '/change-password', label: 'Change Password', icon: 'key' },
  ]

  const isActive = (to, end) => {
    const [path, query] = to.split('?')
    if (query) return location.pathname === path && location.search === `?${query}`
    return end ? location.pathname === path : location.pathname.startsWith(path)
  }

  return (
    <div className={`shell ${collapsed ? 'collapsed' : ''}`}>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <Icon name="invoice" size={20} />
          </div>
          <div className="brand-name">
            <strong>Invoice Manager</strong>
            <small>{companies.map((c) => c.name).join(' · ')}</small>
          </div>
          <button type="button" className="icon-btn sidebar-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <Icon name="x" />
          </button>
        </div>
        <nav>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              title={collapsed ? l.label : undefined}
              className={() => `nav-link ${isActive(l.to, l.end) ? 'active' : ''}`}
            >
              <Icon name={l.icon} />
              <span>{l.label}</span>
              {l.dot && <i className="nav-dot" style={{ background: l.dot }} />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="me">
            <div className="avatar">{user.full_name.slice(0, 1).toUpperCase()}</div>
            <div className="me-text">
              <strong>{user.full_name}</strong>
              <small>{user.role === 'super_admin' ? 'Admin' : 'Staff'}</small>
            </div>
          </div>
          <button type="button" className="nav-link logout" onClick={logout} title={collapsed ? 'Logout' : undefined}>
            <Icon name="logout" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn menu-btn"
            onClick={toggleMenu}
            aria-label="Menu"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon name="menu" />
          </button>
          <strong className="topbar-title">Invoice Manager</strong>
          <UserMenu user={user} onLogout={logout} />
          <button type="button" className="btn btn-sm topbar-logout" onClick={logout} title="Logout">
            <Icon name="logout" size={16} />
            <span className="hide-sm">Logout</span>
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
