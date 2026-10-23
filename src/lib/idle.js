// Runs `fn` once the page has finished loading and the browser has a quiet moment, so work that is
// not needed for the first paint (analytics, the visitor count, saved content) never competes with it.
export function whenIdle(fn, timeout = 2500) {
  const run = () => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout })
    else setTimeout(fn, 300)
  }
  if (document.readyState === 'complete') run()
  else window.addEventListener('load', () => setTimeout(run, 200), { once: true })
}
