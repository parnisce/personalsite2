import { getSupabase } from './supabaseLazy'

// First-party, cookie-free analytics. Each page view and a few events are saved to the
// analytics_events table in Supabase. No IP address or personal detail is stored, and the only
// identifier is a random id kept in sessionStorage, which disappears when the tab is closed
// (so the numbers are "visits", not "unique people").
//
// Nothing is recorded for: the admin, a browser with Do Not Track on, automated browsers,
// localhost (unless localStorage 'cb-track-dev' is set) or a browser you excluded from the
// Analytics page in the admin.

export const EXCLUDE_KEY = 'cb-no-track'
const SESSION_KEY = 'cb-visit'
const OWN_HOSTS = ['cyrylbitangcol.com', 'www.cyrylbitangcol.com']

const read = (storage, key) => {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function enabled() {
  if (typeof window === 'undefined') return false
  if (read(localStorage, EXCLUDE_KEY)) return false
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return false
  if (navigator.webdriver) return false
  if (location.pathname.startsWith('/admin')) return false
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && !read(localStorage, 'cb-track-dev')) return false
  return true
}

function sessionId() {
  let id = read(sessionStorage, SESSION_KEY)
  if (!id) {
    id = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/-/g, '').slice(0, 24)
    try {
      sessionStorage.setItem(SESSION_KEY, id)
    } catch {
      // Without storage every page view counts as its own visit.
    }
  }
  return id
}

const deviceType = () => (window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1100 ? 'tablet' : 'desktop')

// "/resources/#/some-article" becomes "/resources/some-article". Section anchors on the home page are ignored.
export function currentPath() {
  const hashRoute = location.hash.startsWith('#/') ? location.hash.slice(1).replace(/\/+$/, '') : ''
  const base = location.pathname.replace(/\/+$/, '') || '/'
  return `${base === '/' ? '' : base}${hashRoute}` || '/'
}

function referrerHost() {
  try {
    const host = new URL(document.referrer).hostname
    return !host || host === location.hostname || OWN_HOSTS.includes(host) ? '' : host
  } catch {
    return ''
  }
}

function send(row) {
  try {
    const payload = { session_id: sessionId(), device: deviceType(), ...row }
    getSupabase()
      .then((supabase) => supabase.from('analytics_events').insert(payload))
      .then(
        () => {},
        () => {},
      )
  } catch {
    // Tracking must never get in the way of the page.
  }
}

let lastPath = ''
export function trackPageview() {
  if (!enabled()) return
  const path = currentPath()
  if (path === lastPath) return
  lastPath = path
  const q = new URLSearchParams(location.search)
  send({
    type: 'pageview',
    path: path.slice(0, 300),
    referrer: referrerHost().slice(0, 200) || null,
    utm_source: q.get('utm_source')?.slice(0, 100) || null,
    utm_medium: q.get('utm_medium')?.slice(0, 100) || null,
    utm_campaign: q.get('utm_campaign')?.slice(0, 100) || null,
  })
}

export function track(name, detail) {
  if (!enabled()) return
  send({ type: 'event', name: String(name).slice(0, 80), detail: detail ? String(detail).slice(0, 200) : null, path: currentPath().slice(0, 300) })
}

// Page views for every page and hash route, plus clicks on email and outside links.
export function initTracking() {
  if (!enabled()) return
  trackPageview()
  window.addEventListener('hashchange', trackPageview)
  document.addEventListener(
    'click',
    (e) => {
      const link = e.target instanceof Element ? e.target.closest('a[href]') : null
      if (!link) return
      const href = link.getAttribute('href') ?? ''
      if (href.startsWith('mailto:')) track('email_click', href.slice(7).split('?')[0])
      else if (/^https?:/i.test(href)) {
        try {
          const host = new URL(href).hostname
          if (host !== location.hostname) track('outbound_click', host)
        } catch {
          // Not a link we can read.
        }
      }
    },
    { capture: true },
  )
}
