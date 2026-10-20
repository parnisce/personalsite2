import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PresenceBadge from './components/PresenceBadge'
import ToolsPage from './ToolsPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToolsPage />
      <PresenceBadge />
  </StrictMode>,
)
