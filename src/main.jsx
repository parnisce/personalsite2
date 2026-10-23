import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initTracking } from './lib/track'
import App from './App.jsx'
import PresenceBadge from './components/PresenceBadge'
import { applyCachedContent, refreshSiteContent } from './lib/content'

// Saved content comes from the last visit's cache, so nothing here waits on the network.
applyCachedContent()
initTracking()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <PresenceBadge />
  </StrictMode>,
)

refreshSiteContent()
