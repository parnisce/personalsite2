import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AdminApp from './admin/AdminApp.jsx'
import AuthGate, { signOut } from './admin/AuthGate.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthGate>{(user) => <AdminApp key={user.id} user={user} onSignOut={signOut} />}</AuthGate>
  </StrictMode>,
)
