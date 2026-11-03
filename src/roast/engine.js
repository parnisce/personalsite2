// Roast scan: loads a site the way a visitor and a search engine would and gathers the raw facts.
// Page fetching, rendering, the authority lookup and the AI review go through /api/roast/*
// (a same-origin proxy to the roast service); DNS, PageSpeed and the rest are called directly.
import { parsePage, parseDocument, visibleText } from './parse'

// Google API key for PageSpeed and Safe Browsing (restrict it to this site's domain in Google Cloud).
// Without VITE_GOOGLE_API_KEY, PageSpeed runs keyless, which Google rate-limits, and Safe Browsing is skipped.
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_API_KEY || ''

const PROBES = ['/.env', '/.git/HEAD', '/wp-json/wp/v2/users', '/xmlrpc.php', '/server-status', '/wp-content/uploads/']

export const STEPS = [
  { id: 'home', label: 'Loading the homepage' },
  { id: 'basics', label: 'Checking HTTPS, robots.txt, sitemap and llms.txt' },
  { id: 'crawl', label: 'Crawling pages' },
  { id: 'links', label: 'Testing internal links' },
  { id: 'infra', label: 'Checking DNS, email security, domain age and security headers' },
  { id: 'probes', label: 'Probing for exposed files and endpoints' },
  { id: 'speed', label: 'Running Google PageSpeed (mobile + desktop)' },
  { id: 'authority', label: 'Looking up authority and Safe Browsing' },
  { id: 'ai', label: 'AI review of design, copy, conversion and trust' },
]

const FILE_EXT = /\.(jpe?g|png|gif|webp|avif|svg|ico|pdf|zip|mp4|mp3|mov|docx?|xlsx?|pptx?|css|js|xml|json|txt)$/i
const sameHost = (a, b) => a.replace(/^www\./, '') === b.replace(/^www\./, '')

// What the scan hands the caller while it runs: a log line for the "live requests" panel.
let log = null
const short = (u) => {
  try {
    const p = new URL(u)
    return `${p.pathname}${p.search}`.slice(0, 80) || '/'
  } catch {
    return String(u).slice(0, 80)
  }
}

// ---------------------------------------------------------------- network helpers
const apiUrl = (url, mode) => `/api/roast/fetch?mode=${mode}&url=${encodeURIComponent(url)}`

async function fetchSite(url, mode = 'page') {
  const empty = { url, finalUrl: url, status: 0, chain: [], headers: {}, ms: 0, cookies: [] }
  try {
    const res = await fetch(apiUrl(url, mode))
    const meta = res.headers.get('x-roast-meta')
    const out = meta
      ? { url, ...JSON.parse(decodeURIComponent(meta)), body: (await res.text()).slice(0, 3e6) }
      : { ...empty, ...(await res.json()) }
    log?.({ label: `GET ${short(url)}`, status: out.status, ms: out.ms })
    return out
  } catch {
    log?.({ label: `GET ${short(url)}`, status: 0 })
    return { ...empty, error: 'Network error' }
  }
}

async function getJson(url, init) {
  try {
    const started = Date.now()
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(90000) })
    const label = url.startsWith('/') ? url.split('?')[0] : new URL(url).hostname
    log?.({ label: `${init?.method ?? 'GET'} ${label}`, status: res.status, ms: Date.now() - started })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

// Runs `task` over `items`, `size` at a time, keeping the results in order.
async function pool(items, size, task) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await task(items[i])
      }
    }),
  )
  return out
}

async function renderInBrowser(url) {
  const started = Date.now()
  try {
    const res = await fetch(`/api/roast/render?url=${encodeURIComponent(url)}`)
    log?.({ label: `RENDER ${short(url)} in a real browser`, status: res.status, ms: Date.now() - started })
    return res.ok ? await res.text() : null
  } catch {
    return null
  }
}

const sitemapUrls = (xml) => [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/gi)].map((m) => m[1].replace(/&amp;/g, '&'))

// ---------------------------------------------------------------- DNS, domain, security lookups
async function txtRecords(name) {
  const res = await getJson(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=TXT`)
  return (res?.Answer ?? []).map((a) => a.data.replace(/^"|"$/g, '').replace(/" "/g, ''))
}

async function lookupMail(domain) {
  const [mx, spfTxt, dmarcTxt] = await Promise.all([getJson(`https://dns.google/resolve?name=${domain}&type=MX`), txtRecords(domain), txtRecords(`_dmarc.${domain}`)])
  if (!mx && !spfTxt.length && !dmarcTxt.length) return null
  return {
    mx: (mx?.Answer ?? []).map((a) => a.data),
    spf: spfTxt.find((t) => /^v=spf1/i.test(t)) ?? null,
    dmarc: dmarcTxt.find((t) => /^v=DMARC1/i.test(t)) ?? null,
  }
}

async function lookupDomain(domain) {
  const data =
    (await getJson(`https://rdap.org/domain/${domain}`)) ??
    (/\.(com|net)$/.test(domain) ? await getJson(`https://rdap.verisign.com/${domain.split('.').pop()}/v1/domain/${domain}`) : null)
  if (!data) return null
  const when = (action) => data.events?.find((e) => e.eventAction === action)?.eventDate
  const registrar = data.entities?.find((e) => e.roles?.includes('registrar'))?.vcardArray?.[1]?.find((f) => f[0] === 'fn')?.[3]
  return { created: when('registration'), expires: when('expiration'), registrar }
}

function summarisePsi(res) {
  const lh = res?.lighthouseResult
  if (!lh?.categories) return null
  const cat = (id) => (lh.categories[id]?.score == null ? null : Math.round(lh.categories[id].score * 100))
  const audits = lh.audits ?? {}
  const num = (id) => audits[id]?.numericValue
  const failing = []
  for (const [category, c] of Object.entries(lh.categories)) {
    for (const ref of c.auditRefs) {
      const a = audits[ref.id]
      if (!a || a.score == null || a.score >= 0.9) continue
      if (['informative', 'notApplicable', 'manual'].includes(a.scoreDisplayMode)) continue
      if (ref.weight === 0 && category !== 'performance') continue
      failing.push({ id: a.id, title: a.title, display: a.displayValue, category, score: a.score })
    }
  }
  const m = res?.loadingExperience?.metrics
  return {
    perf: cat('performance'),
    seo: cat('seo'),
    a11y: cat('accessibility'),
    bp: cat('best-practices'),
    screenshot: audits['final-screenshot']?.details?.data,
    field: m
      ? {
          lcp: m.LARGEST_CONTENTFUL_PAINT_MS?.percentile,
          inp: m.INTERACTION_TO_NEXT_PAINT?.percentile,
          cls: m.CUMULATIVE_LAYOUT_SHIFT_SCORE ? m.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 : undefined,
        }
      : {},
    lab: {
      lcp: num('largest-contentful-paint'),
      cls: num('cumulative-layout-shift'),
      tbt: num('total-blocking-time'),
      fcp: num('first-contentful-paint'),
    },
    failing,
  }
}

const pageSpeed = (url, strategy) =>
  getJson(
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=PERFORMANCE&category=SEO&category=ACCESSIBILITY&category=BEST_PRACTICES${GOOGLE_KEY ? `&key=${GOOGLE_KEY}` : ''}`,
  ).then(summarisePsi)

async function safeBrowsingFlagged(url) {
  if (!GOOGLE_KEY) return null
  const res = await getJson(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${GOOGLE_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client: { clientId: 'roast-my-website', clientVersion: '1.0' },
      threatInfo: {
        threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: [{ url }],
      },
    }),
  })
  return res ? !!res.matches?.length : null
}

// ---------------------------------------------------------------- the AI review
const FORM_TOOL = /leadconnectorhq\.com\/widget\/(?:form|survey|booking)|msgsndr\.com\/widget|form_embed\.js|js\.hsforms\.net|gform_wrapper|wpcf7|wpforms-form|elementor-form|jotform|typeform|formspree|calendly\.com/i

async function aiReview(h, shots) {
  const first = h.pages[0]
  const nav = [...h.doc.querySelectorAll('nav a, header a')].map((a) => (a.textContent ?? '').trim()).filter(Boolean).slice(0, 20)
  const buttons = [...h.doc.querySelectorAll('a, button')]
    .map((a) => (a.textContent ?? '').replace(/\s+/g, ' ').trim())
    .filter((t) => t && t.length < 40)
    .slice(0, 40)
  const facts = `Title: ${first.title}
Meta description: ${first.description || 'none'}
H1: ${first.h1s.join(' | ') || 'none'}
Navigation: ${nav.join(' · ') || 'none found'}
Buttons/links on homepage: ${buttons.join(' · ')}
Phone links: ${h.doc.querySelectorAll('a[href^="tel:"]').length}; forms: ${FORM_TOOL.test(h.allHtml) ? 'embedded form tool' : first.forms ? `${first.forms} unrecognised` : 'none'}
Pages crawled: ${h.pages.map((p) => `${new URL(p.url).pathname} "${p.title.slice(0, 60)}" (${p.words} words)`).join('; ')}
Mobile speed: ${h.psi?.mobile?.perf ?? 'unknown'}/100
Homepage text (first 3,500 characters):
${h.text.slice(0, 3500)}`
  const res = await fetch('/api/roast/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: h.origin, facts, shots }),
  })
  return res
}

// ---------------------------------------------------------------- the scan
// step(id, state, note): progress; hit(entry): a request for the live log; partial(data): data so far.
export async function runScan(origin, host, { step, hit, partial } = {}) {
  log = hit ?? null
  try {
    return await scan(origin, host, step ?? (() => {}), partial)
  } finally {
    log = null
  }
}

async function scan(startOrigin, host, step, partial) {
  const started = Date.now()
  step('home', 'run')
  let home = await fetchSite(startOrigin)
  if (home.error || !home.body) {
    const plain = await fetchSite(startOrigin.replace(/^https:/, 'http:'))
    if (plain.body) home = plain
  }
  if (!home.body) {
    step('home', 'fail', home.error)
    throw new Error(home.error ?? `The site answered ${home.status || 'nothing'}, so there's nothing to scan.`)
  }
  if (home.status >= 400) {
    step('home', 'fail', `HTTP ${home.status}`)
    throw new Error(
      home.status === 403 || home.status === 503
        ? `The site blocked the scan (HTTP ${home.status}). Bot protection like Cloudflare's challenge stops automated checks.`
        : `The homepage answered HTTP ${home.status}.`,
    )
  }

  const origin = new URL(home.finalUrl).origin
  let page = parsePage(home, host)
  let js = null

  // A page built entirely by JavaScript has no text in its HTML: look at it in a real browser.
  if (page.words < 50 && /<div[^>]+id=["'](root|app|__next|__nuxt|svelte|q-app)["'][^>]*>\s*<\/div>|<script[^>]+type=["']module["']/i.test(home.body)) {
    step('home', 'run', 'Page is built by JavaScript: rendering it in a real browser…')
    const html = await renderInBrowser(home.finalUrl)
    js = { rawWords: page.words, rendered: false }
    if (html) {
      const rendered = parsePage({ ...home, body: html }, host)
      if (rendered.words > page.words) {
        home = { ...home, body: html }
        page = rendered
        js.rendered = true
      }
    }
  }

  const html = home.body
  const h = {
    origin,
    host,
    startedAt: started,
    finishedAt: 0,
    home,
    doc: parseDocument(html),
    html,
    allHtml: html,
    pages: [page],
    js,
    httpCheck: null,
    soft404: null,
    robots: null,
    sitemapFound: false,
    sitemapCount: 0,
    llms: false,
    links: [],
    dns: null,
    observatory: null,
    rdap: null,
    probes: {},
    psi: null,
    safeBrowsing: null,
    authority: null,
    ai: null,
  }
  const push = () => partial?.({ ...h })
  step('home', 'done', `${home.status} in ${(home.ms / 1000).toFixed(1)}s`)
  push()

  // PageSpeed is slow, so it runs alongside everything else.
  const speed = Promise.all([
    pageSpeed(origin, 'mobile').then((r) => {
      if (r?.screenshot) log?.({ label: 'Phone screenshot captured', status: 200, shot: r.screenshot })
      return r
    }),
    pageSpeed(origin, 'desktop'),
  ])

  step('basics', 'run')
  const [httpCheck, robotsRes, llmsRes, missing] = await Promise.all([
    fetchSite(`http://${new URL(origin).host}/`, 'status'),
    fetchSite(`${origin}/robots.txt`),
    fetchSite(`${origin}/llms.txt`),
    fetchSite(`${origin}/this-page-should-not-exist-${Date.now().toString(36)}`, 'status'),
  ])
  const robotsText = robotsRes.status === 200 ? (robotsRes.body?.split(/<!doctype|<html/i)[0] ?? '') : ''
  const robots = /^\s*user-agent\s*:/im.test(robotsText) ? robotsText : null
  const sitemapCandidates = [
    ...new Set([...(robots?.match(/^sitemap:\s*(\S+)/gim) ?? []).map((l) => l.replace(/^sitemap:\s*/i, '')), `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/wp-sitemap.xml`]),
  ]
  let urls = []
  for (const candidate of sitemapCandidates.slice(0, 4)) {
    const res = await fetchSite(candidate)
    if (res.status === 200 && res.body && /<(urlset|sitemapindex)/i.test(res.body)) {
      h.sitemapFound = true
      if (/<sitemapindex/i.test(res.body)) {
        const children = sitemapUrls(res.body)
          .sort((a, b) => Number(/page/i.test(b)) - Number(/page/i.test(a)))
          .slice(0, 3)
        for (const child of await pool(children, 3, (u) => fetchSite(u))) urls.push(...sitemapUrls(child.body ?? ''))
      } else {
        urls = sitemapUrls(res.body)
      }
      break
    }
  }
  Object.assign(h, {
    httpCheck: httpCheck.error ? null : httpCheck,
    soft404: missing.error ? null : missing,
    robots,
    sitemapCount: urls.length,
    llms: llmsRes.status === 200 && !!llmsRes.body && !/<html/i.test(llmsRes.body.slice(0, 500)),
  })
  step('basics', 'done', h.sitemapFound ? `sitemap: ${urls.length} URLs` : 'no sitemap')
  push()

  step('crawl', 'run')
  const crawlTargets = js
    ? []
    : [...new Set(urls.length ? urls : page.links)]
        .filter((u) => {
          try {
            const p = new URL(u)
            return sameHost(p.hostname, host) && !FILE_EXT.test(p.pathname) && p.href.replace(/\/$/, '') !== origin
          } catch {
            return false
          }
        })
        .sort((a, b) => new URL(a).pathname.split('/').length - new URL(b).pathname.split('/').length)
        .slice(0, 14)
  const crawled = await pool(crawlTargets, 4, (u) => fetchSite(u))
  h.pages = [page, ...crawled.filter((c) => c.body).map((c) => parsePage(c, host))]
  h.allHtml = [html, ...crawled.map((c) => c.body ?? '')].join('\n')
  const failedPages = crawled.filter((c) => !c.body).map((c) => ({ url: c.url, status: c.status }))
  step('crawl', 'done', `${h.pages.length} pages`)
  push()

  step('links', 'run')
  const seen = new Set(h.pages.map((p) => p.url.replace(/\/$/, '')))
  const toCheck = [...new Set(h.pages.flatMap((p) => p.links))].filter((u) => !seen.has(u.replace(/\/$/, ''))).slice(0, 40)
  const checked = await pool(toCheck, 6, (u) => fetchSite(u, 'status'))
  h.links = [...failedPages, ...h.pages.map((p) => ({ url: p.url, status: p.status })), ...checked.map((c) => ({ url: c.url, status: c.status }))]
  step('links', 'done', `${h.links.length} URLs, ${h.links.filter((l) => l.status >= 400).length} broken`)
  push()

  step('infra', 'run')
  const bare = host.replace(/^www\./, '')
  const [dns, observatory, rdap] = await Promise.all([
    lookupMail(bare),
    getJson(`https://observatory-api.mdn.mozilla.net/api/v2/scan?host=${new URL(origin).host}`, { method: 'POST' }),
    lookupDomain(bare),
  ])
  Object.assign(h, { dns, observatory: observatory?.grade ? { grade: observatory.grade, score: observatory.score ?? 0 } : null, rdap })
  step('infra', 'done', observatory?.grade ? `Observatory ${observatory.grade}` : undefined)
  push()

  step('probes', 'run')
  const exposed = await pool(PROBES, 3, async (path) => {
    try {
      const res = await (await fetch(apiUrl(`${origin}${path}`, 'probe'))).json()
      log?.({ label: `PROBE ${path}${res.exposed ? ' (EXPOSED)' : ''}`, status: res.status ?? 0 })
      return res.exposed === true
    } catch {
      return false
    }
  })
  h.probes = Object.fromEntries(PROBES.map((p, i) => [p, exposed[i]]))
  step('probes', 'done', `${exposed.filter(Boolean).length} exposed`)
  push()

  step('speed', 'run')
  const [mobile, desktop] = await speed
  h.psi = { mobile, desktop }
  step('speed', mobile || desktop ? 'done' : 'fail', mobile?.perf != null ? `mobile ${mobile.perf} · desktop ${desktop?.perf ?? '–'}` : "PageSpeed couldn't test this site")
  push()

  step('authority', 'run')
  const [authority, flagged] = await Promise.all([getJson(`/api/roast/authority?host=${bare}`), safeBrowsingFlagged(origin)])
  h.safeBrowsing = flagged
  h.authority = authority?.configured ? { pageRank: authority.pageRank, rank: authority.rank } : null
  step('authority', 'done')
  push()

  step('ai', 'run')
  h.text = visibleText(h.doc)
  const shots = [h.psi?.mobile?.screenshot && { label: 'Phone', data: h.psi.mobile.screenshot }, h.psi?.desktop?.screenshot && { label: 'Desktop', data: h.psi.desktop.screenshot }].filter(Boolean)
  try {
    const res = await aiReview(h, shots)
    if (res.ok) {
      h.ai = await res.json()
      step('ai', 'done')
    } else {
      h.aiNote = (await res.json().catch(() => ({}))).error ?? 'AI review failed.'
      step('ai', res.status === 501 ? 'skip' : 'fail', res.status === 501 ? 'Not configured' : h.aiNote)
    }
  } catch {
    h.aiNote = 'AI review failed.'
    step('ai', 'fail', h.aiNote)
  }
  h.finishedAt = Date.now()
  return h
}
