import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Messages from the website contact form (table enquiries), newest first.
export function useEnquiries() {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    const { data, error: err } = await supabase.from('enquiries').select('*').order('created_at', { ascending: false }).limit(500)
    if (err) {
      setError(err.message)
    } else {
      setError('')
      setItems(data)
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    reload()
    const refresh = () => document.visibilityState === 'visible' && reload()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    // New messages appear as they arrive.
    const channel = supabase
      .channel('enquiries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enquiries' }, reload)
      .subscribe()
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      supabase.removeChannel(channel)
    }
  }, [reload])

  const setRead = async (id, read) => {
    setItems((list) => list.map((e) => (e.id === id ? { ...e, read } : e)))
    const { error: err } = await supabase.from('enquiries').update({ read }).eq('id', id)
    if (err) reload()
  }

  const remove = async (id) => {
    setItems((list) => list.filter((e) => e.id !== id))
    const { error: err } = await supabase.from('enquiries').delete().eq('id', id)
    if (err) reload()
  }

  return { items, error, loaded, reload, setRead, remove, unread: items.filter((e) => !e.read).length }
}
