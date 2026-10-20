import { useEffect, useId, useState } from 'react'
import logo from '../assets/logo.webp'
import { supabase } from '../lib/supabase'
import { EXCLUDE_KEY } from '../lib/track'
import { STORAGE_KEY } from './store'
import './admin.css'

// The admin only opens for a signed-in Supabase user. The data is protected by row-level
// security on the server, so this screen is the door and the database is the lock.
function Login() {
  const base = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (err) setError(err.message === 'Invalid login credentials' ? 'That email or password is not right.' : err.message)
    setBusy(false)
  }

  return (
    <div className="adm adm-login-page">
      <form className="adm-login" onSubmit={submit}>
        <img src={logo} alt="" width="48" height="48" />
        <h1>Sign in</h1>
        <p className="adm-sub">Task manager and website admin</p>
        <div className="adm-field">
          <label htmlFor={`${base}-email`}>Email</label>
          <input id={`${base}-email`} type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="adm-field">
          <label htmlFor={`${base}-pw`}>Password</label>
          <input id={`${base}-pw`} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && (
          <p className="adm-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="adm-btn is-primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <a className="adm-login-back" href="/">
          Back to the site
        </a>
      </form>
    </div>
  )
}

export function signOut() {
  try {
    localStorage.removeItem(STORAGE_KEY) // do not leave the data behind on a shared computer
  } catch {
    // Nothing to clear.
  }
  return supabase.auth.signOut()
}

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined) // undefined while checking

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    // The first time you sign in on a browser, leave it out of the analytics (changeable on the Analytics page).
    try {
      if (!localStorage.getItem('cb-track-decided')) {
        localStorage.setItem('cb-track-decided', '1')
        localStorage.setItem(EXCLUDE_KEY, '1')
      }
    } catch {
      // No storage, nothing to remember.
    }
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div className="adm adm-login-page" aria-busy="true" />
  if (!session) return <Login />
  return children(session.user)
}
