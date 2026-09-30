import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import { CompaniesProvider } from './companies'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import ChangePassword from './pages/ChangePassword'
import Companies from './pages/Companies'
import Dashboard from './pages/Dashboard'
import InvoiceForm from './pages/InvoiceForm'
import Invoices from './pages/Invoices'
import InvoiceView from './pages/InvoiceView'
import Login from './pages/Login'
import Users from './pages/Users'

export default function App() {
  const { user, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="center-screen">
        <Spinner />
      </div>
    )
  }
  if (!user) return <Login />

  return (
    <CompaniesProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="invoices/new" element={<InvoiceForm />} />
          <Route path="invoices/:id" element={<InvoiceView />} />
          <Route path="invoices/:id/edit" element={<InvoiceForm />} />
          {isAdmin && <Route path="companies" element={<Companies />} />}
          {isAdmin && <Route path="users" element={<Users />} />}
          <Route path="change-password" element={<ChangePassword />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </CompaniesProvider>
  )
}
