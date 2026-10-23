import { PROJECTS, STATS, TESTIMONIALS } from '../data'
import { getSupabase } from './supabaseLazy'

const isList = (v, fields) => Array.isArray(v) && v.length > 0 && v.every((x) => x && fields.every((f) => typeof x[f] === 'string' && x[f]))

export const CONTENT_SHAPES = {
  projects: { target: PROJECTS, valid: (v) => isList(v, ['title', 'url', 'description']) },
  testimonials: { target: TESTIMONIALS, valid: (v) => isList(v, ['quote', 'name']) },
  stats: { target: STATS, valid: (v) => Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x.label === 'string' && Number.isFinite(Number(x.value))) },
}

// The page reads PROJECTS, TESTIMONIALS and STATS straight from data.js. The last content fetched
// from Supabase is kept in localStorage and applied before the first render, so the page never
// waits on the network; a background fetch after load refreshes the copy for the next visit.
// Anything missing or broken keeps the built-in copy.
const CACHE_KEY = 'cb-site-content-v1'

const readCache = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') ?? {}
  } catch {
    return {}
  }
}

export function applyCachedContent() {
  Object.entries(readCache()).forEach(([key, value]) => {
    const shape = CONTENT_SHAPES[key]
    if (shape?.valid(value)) shape.target.splice(0, shape.target.length, ...value)
  })
}

// The admin calls this after saving, so this browser sees its own change on the next load.
export function writeCachedContent(key, value) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...readCache(), [key]: value }))
  } catch {
    // No storage: the change shows once the background refresh has run.
  }
}

export async function refreshSiteContent() {
  try {
    const supabase = await getSupabase()
    const { data } = await supabase.from('site_content').select('key,data')
    const map = {}
    ;(data ?? []).forEach(({ key, data: value }) => {
      if (CONTENT_SHAPES[key]?.valid(value)) map[key] = value
    })
    localStorage.setItem(CACHE_KEY, JSON.stringify(map))
  } catch {
    // Keep what is cached.
  }
}
