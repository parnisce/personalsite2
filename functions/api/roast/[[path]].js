// Cloudflare Pages Function: passes /api/roast/* on to the roast service, so the browser only ever
// talks to this site (no cross-origin requests). The page fetcher, headless-browser render,
// authority lookup and AI review live there.
const UPSTREAM = 'https://cyrusbitangcol.com'

export async function onRequest({ request }) {
  const url = new URL(request.url)
  const init = {
    method: request.method,
    headers: { 'Content-Type': request.headers.get('Content-Type') ?? 'application/json' },
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
  }
  const res = await fetch(`${UPSTREAM}${url.pathname}${url.search}`, init)
  // The page fetcher reports status and headers of the scanned site in x-roast-meta.
  const headers = new Headers()
  for (const name of ['content-type', 'x-roast-meta']) {
    const value = res.headers.get(name)
    if (value) headers.set(name, value)
  }
  headers.set('Cache-Control', 'no-store')
  return new Response(res.body, { status: res.status, headers })
}
