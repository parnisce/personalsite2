import { createContext, useContext } from 'react'

// Everything the screens need from AdminApp: the data, the actions that change it, and the
// helpers that open the editors.
export const AdminContext = createContext(null)

export function useAdmin() {
  const value = useContext(AdminContext)
  if (!value) throw new Error('useAdmin must be used inside <AdminApp>')
  return value
}
