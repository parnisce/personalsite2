// HTML helpers for the roast scan.
const sameHost = (a, b) => a.replace(/^www\./, '') === b.replace(/^www\./, '')
const FILE_EXT = /\.(jpe?g|png|gif|webp|avif|svg|ico|pdf|zip|mp4|mp3|mov|docx?|xlsx?|pptx?|css|js|xml|json|txt)$/i

export const parseDocument = (html) => new DOMParser().parseFromString(html, 'text/html')

// The readable text of a document, without scripts, styles and icons.
export function visibleText(doc) {
  const body = doc.body?.cloneNode(true)
  if (!body) return ''
  body.querySelectorAll('script,style,noscript,template,svg').forEach((n) => n.remove())
  return (body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

// One crawled page boiled down to the facts the checks need.
export function parsePage(res, host) {
  const doc = parseDocument(res.body ?? '')
  const base = res.finalUrl || res.url
  const links = new Set()
  doc.querySelectorAll('a[href]').forEach((a) => {
    try {
      const u = new URL(a.getAttribute('href'), base)
      if ((u.protocol === 'https:' || u.protocol === 'http:') && sameHost(u.hostname, host) && !FILE_EXT.test(u.pathname) && !u.pathname.startsWith('/cdn-cgi/')) {
        u.hash = ''
        links.add(u.href)
      }
    } catch {
      /* not a usable link */
    }
  })
  const images = [...doc.querySelectorAll('img')]
  const meta = (selector) => doc.querySelector(selector)?.getAttribute('content')?.trim() ?? ''
  return {
    url: base,
    status: res.status,
    ms: res.ms,
    bytes: res.body?.length ?? 0,
    title: doc.title.trim(),
    description: meta('meta[name="description" i]'),
    h1s: [...doc.querySelectorAll('h1')].map((h) => (h.textContent ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean),
    canonical: doc.querySelector('link[rel="canonical" i]')?.getAttribute('href') ?? '',
    noindex: /noindex/i.test(meta('meta[name="robots" i]')) || /noindex/i.test(res.headers?.['x-robots-tag'] ?? ''),
    lang: doc.documentElement.getAttribute('lang') ?? '',
    words: visibleText(doc)
      .split(' ')
      .filter((w) => /\w/.test(w)).length,
    images: images.length,
    imagesNoAlt: images.filter((i) => !i.hasAttribute('alt')).length,
    forms: doc.querySelectorAll('form').length,
    links: [...links],
    ogTitle: !!meta('meta[property="og:title" i]'),
    ogImage: !!meta('meta[property="og:image" i]'),
    viewport: meta('meta[name="viewport" i]'),
  }
}
