import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PresenceBadge from './components/PresenceBadge'
import { initTracking } from './lib/track'
import ResourcesPage from './ResourcesPage.jsx'

initTracking()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ResourcesPage />
    <PresenceBadge />
  </StrictMode>,
)
