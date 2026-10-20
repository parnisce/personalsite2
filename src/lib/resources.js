import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { supabase } from './supabase'

// ---------------------------------------------------------------- text helpers

export const slugify = (text) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

export const parseTags = (text) => [...new Set(text.split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 8)

export const readingMinutes = (markdown) => Math.max(1, Math.round((markdown.trim().split(/\s+/).filter(Boolean).length || 0) / 200))

export const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')

export function formatCount(n) {
  if (!Number.isFinite(n)) return ''
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${n >= 1e5 ? Math.round(n / 1e3) : +(n / 1e3).toFixed(1)}k`
  return String(n)
}

export function timeAgo(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (!Number.isFinite(days)) return ''
  if (days < 1) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} ago`
  const years = Math.floor(months / 12)
  return `${years} ${years === 1 ? 'year' : 'years'} ago`
}

// ---------------------------------------------------------------- markdown

let hooked = false
export function renderMarkdown(markdown) {
  if (!hooked) {
    hooked = true
    // Links that leave the site open in a new tab.
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A' && /^https?:/i.test(node.getAttribute('href') ?? '')) {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer')
      }
    })
  }
  return DOMPurify.sanitize(marked.parse(markdown || '', { gfm: true }))
}

// ---------------------------------------------------------------- GitHub

export function parseRepo(url) {
  const m = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i.exec(url.trim())
  return m ? { owner: m[1], repo: m[2] } : null
}

// Public numbers for a repo (stars, language, licence, last update), from GitHub's open API.
export async function fetchRepo(url) {
  const parsed = parseRepo(url)
  if (!parsed) throw new Error('That does not look like a GitHub repo link, e.g. https://github.com/owner/repo')
  const res = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, { headers: { Accept: 'application/vnd.github+json' } })
  if (res.status === 404) throw new Error('GitHub could not find that repo. Is it public?')
  if (!res.ok) throw new Error(`GitHub answered with an error (${res.status}). Try again in a minute.`)
  const r = await res.json()
  return {
    full_name: r.full_name,
    html_url: r.html_url,
    stars: r.stargazers_count,
    language: r.language,
    license: r.license?.spdx_id && r.license.spdx_id !== 'NOASSERTION' ? r.license.spdx_id : r.license?.name ?? null,
    pushed_at: r.pushed_at,
    description: r.description,
    topics: r.topics ?? [],
    default_branch: r.default_branch,
  }
}

// ---------------------------------------------------------------- public reads

const CARD_FIELDS = 'id,slug,title,summary,tags,github,published_at,body'

export async function listPublished() {
  const { data, error } = await supabase.from('resources').select(CARD_FIELDS).eq('published', true).order('published_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getPublished(slug) {
  const { data, error } = await supabase.from('resources').select('*').eq('slug', slug).eq('published', true).maybeSingle()
  if (error) throw error
  return data
}
