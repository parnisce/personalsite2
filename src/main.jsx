import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PresenceBadge from './components/PresenceBadge'
import App from './App.jsx'
import { loadSiteContent } from './lib/content'

// Content edited in the admin is fetched first so the scroll animations are built on the final page.
loadSiteContent().finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
      <PresenceBadge />
    </StrictMode>,
  )
})
