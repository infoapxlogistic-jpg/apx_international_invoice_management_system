import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api'

const CompaniesContext = createContext({ companies: [], reload: () => {} })

export function CompaniesProvider({ children }) {
  const [companies, setCompanies] = useState([])

  const reload = useCallback(() => {
    api.get('/companies').then(setCompanies).catch(() => {})
  }, [])

  useEffect(reload, [reload])

  return <CompaniesContext.Provider value={{ companies, reload }}>{children}</CompaniesContext.Provider>
}

// Only one company is switched on at the moment; screens hide company pickers when there is one.
export const useCompanies = () => {
  const { companies, reload } = useContext(CompaniesContext)
  return { companies, reload, multi: companies.length > 1 }
}

export const newInvoiceLabel = (c, multi) => (multi ? `${c.name} Invoice` : 'New Invoice')
