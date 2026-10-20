import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './PresenceBadge.css'

// A floating "N people here" pill. It uses Supabase Realtime Presence, so there is no table and
// nothing is stored: each open tab joins a shared channel while it is visible, and the pill
// shows how many are in it. A tab in the background leaves the count until it is looked at again.
const CHANNEL = 'site-visitors'

export default function PresenceBadge() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const key = globalThis.crypto?.randomUUID?.() ?? String(Math.random()).slice(2)
    const channel = supabase.channel(CHANNEL, { config: { presence: { key } } })
    let joined = false

    const join = () => {
      if (joined || document.visibilityState !== 'visible') return
      joined = true
      channel.track({ at: Date.now() })
    }
    const leave = () => {
      if (!joined) return
      joined = false
      channel.untrack()
    }
    const onVisibility = () => (document.visibilityState === 'visible' ? join() : leave())

    channel
      .on('presence', { event: 'sync' }, () => setCount(Object.keys(channel.presenceState()).length))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') join()
      })
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      supabase.removeChannel(channel)
    }
  }, [])

  if (count < 1) return null
  return (
    <div className="presence" role="status" aria-live="polite">
      <i aria-hidden="true" />
      <b>{count}</b>
      <span>{count === 1 ? 'person here' : 'people here'}</span>
    </div>
  )
}
