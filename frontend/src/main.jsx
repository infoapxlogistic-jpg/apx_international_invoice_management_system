import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth'
import './styles.css'

// A page left open across a new deploy asks for files the deploy replaced (e.g. the PDF
// maker). Reload once to pick up the new files; the time check stops a reload loop.
window.addEventListener('vite:preloadError', (e) => {
  try {
    if (Date.now() - (Number(sessionStorage.getItem('reloadedForDeploy')) || 0) < 30000) return
    sessionStorage.setItem('reloadedForDeploy', String(Date.now()))
  } catch {
    return // storage blocked: show the normal error rather than risk reloading forever
  }
  e.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
