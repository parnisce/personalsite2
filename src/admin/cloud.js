import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeState } from './store'

const SAVE_DELAY = 1000

const when = (iso) => new Date(iso).getTime() || 0

// Keeps the task manager data in Supabase (table admin_state, one private row per user).
// The first load takes what is saved online; after that every change is saved a moment later,
// and coming back to the tab picks up changes made on another device.
export function useCloudSync(state, dispatch, userId) {
  const [status, setStatus] = useState('loading') // loading | synced | saving | error
  const ready = useRef(false)
  const [online, setOnline] = useState(false) // re-runs the save effect once the first load is done
  const lastJson = useRef('') // what the cloud is known to hold
  const lastRemote = useRef(0)
  const current = useRef({ json: '' })

  const json = JSON.stringify(state)
  useEffect(() => {
    current.current.json = json
  }, [json])

  const pull = useCallback(async () => {
    const { data, error } = await supabase.from('admin_state').select('data,updated_at').maybeSingle()
    if (error) {
      setStatus('error')
      return
    }
    if (!data) {
      // Nothing online yet: whatever is in this browser becomes the first saved copy.
      ready.current = true
      lastJson.current = ''
      setOnline(true)
      setStatus('saving')
      return
    }
    if (ready.current && when(data.updated_at) === lastRemote.current) return
    if (ready.current && current.current.json !== lastJson.current) return // unsaved local changes win
    const incoming = normalizeState(data.data)
    lastJson.current = JSON.stringify(incoming)
    lastRemote.current = when(data.updated_at)
    ready.current = true
    setOnline(true)
    dispatch({ type: 'REPLACE', state: incoming })
    setStatus('synced')
  }, [dispatch])

  useEffect(() => {
    pull()
    const refresh = () => document.visibilityState === 'visible' && pull()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [pull])

  useEffect(() => {
    if (!ready.current || json === lastJson.current) return undefined
    const timer = setTimeout(async () => {
      setStatus('saving')
      const updatedAt = new Date().toISOString()
      const { error } = await supabase.from('admin_state').upsert({ user_id: userId, data: JSON.parse(json), updated_at: updatedAt })
      if (error) {
        setStatus('error')
        return
      }
      lastJson.current = json
      lastRemote.current = when(updatedAt)
      setStatus(current.current.json === json ? 'synced' : 'saving')
    }, SAVE_DELAY)
    return () => clearTimeout(timer)
  }, [json, userId, online])

  return status
}
