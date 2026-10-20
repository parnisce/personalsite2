import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initTracking } from './lib/track'
import ToolsPage from './ToolsPage.jsx'

initTracking()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToolsPage />
  </StrictMode>,
)
