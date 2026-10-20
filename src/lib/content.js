import { PROJECTS, STATS, TESTIMONIALS } from '../data'
import { supabase } from './supabase'

const isList = (v, fields) => Array.isArray(v) && v.length > 0 && v.every((x) => x && fields.every((f) => typeof x[f] === 'string' && x[f]))

export const CONTENT_SHAPES = {
  projects: { target: PROJECTS, valid: (v) => isList(v, ['title', 'url', 'description']) },
  testimonials: { target: TESTIMONIALS, valid: (v) => isList(v, ['quote', 'name']) },
  stats: { target: STATS, valid: (v) => Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x.label === 'string' && Number.isFinite(Number(x.value))) },
}

// The page reads PROJECTS, TESTIMONIALS and STATS straight from data.js, so the saved content
// replaces those lists in place before the page renders. Anything missing or broken keeps the
// built-in copy, so the site never goes blank if Supabase is down.
export async function loadSiteContent(timeoutMs = 2500) {
  try {
    const request = supabase.from('site_content').select('key,data')
    const { data } = await Promise.race([request, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))])
    ;(data ?? []).forEach(({ key, data: value }) => {
      const shape = CONTENT_SHAPES[key]
      if (shape?.valid(value)) shape.target.splice(0, shape.target.length, ...value)
    })
  } catch {
    // Keep the defaults.
  }
}
