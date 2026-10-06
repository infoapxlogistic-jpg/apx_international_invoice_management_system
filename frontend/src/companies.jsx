import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api'

const CompaniesContext = createContext({ companies: [], currencies: [], reload: () => {} })

export function CompaniesProvider({ children }) {
  const [companies, setCompanies] = useState([])
  const [currencies, setCurrencies] = useState([])

  const reload = useCallback(() => {
    api.get('/companies').then(setCompanies).catch(() => {})
  }, [])

  useEffect(reload, [reload])
  useEffect(() => {
    api.get('/currencies').then(setCurrencies).catch(() => {})
  }, [])

  return (
    <CompaniesContext.Provider value={{ companies, currencies, reload }}>{children}</CompaniesContext.Provider>
  )
}

// Screens hide company pickers when only one company is switched on.
export const useCompanies = () => {
  const { companies, currencies, reload } = useContext(CompaniesContext)
  return { companies, currencies, reload, multi: companies.length > 1 }
}

// { code, symbol, name, decimals } for a currency code, falling back to pounds.
export function findCurrency(currencies, code) {
  return (
    currencies.find((c) => c.code === code) ||
    currencies.find((c) => c.code === 'GBP') || { code: 'GBP', symbol: '£', name: 'Pound Sterling', decimals: 2 }
  )
}

export const newInvoiceLabel = (c, multi) => (multi ? `${c.name} Invoice` : 'New Invoice')
