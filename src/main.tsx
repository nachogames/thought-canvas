import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/globals.css'
import App from './App'

// Console utility to clear app data
declare global {
  interface Window {
    clearThoughtCanvas: (reload?: boolean) => void
  }
}

window.clearThoughtCanvas = (reload = true) => {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('thought-canvas'))
  keys.forEach(k => localStorage.removeItem(k))
  console.log(`Cleared ${keys.length} keys:`, keys)
  if (reload) location.reload()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
