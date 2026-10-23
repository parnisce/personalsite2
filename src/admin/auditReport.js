// Internal audit of the website and admin, carried out on 21 October 2026 against the code in
// this repository and the Supabase schema in supabase/schema.sql. It is a snapshot: edit this
// file as findings are fixed (set status to 'fixed') and re-run the checks before each review.

export const AUDIT = {
  title: 'Website & admin internal audit',
  date: '2026-10-21',
  scope: 'Public site (home, Resources, Free Tools), admin task manager, Supabase schema and policies, build and dependencies.',
  method: 'Code review, npm audit, production build, lint run and a read-through of the Supabase row-level-security policies. Nothing was tested against production traffic.',
}

export const EVIDENCE = [
  { check: 'npm audit (dependencies)', result: '0 known vulnerabilities (0 critical, 0 high, 0 moderate, 0 low)', ok: true },
  { check: 'Production build', result: 'Passes; four pages built (home, tools, resources, admin)', ok: true },
  { check: 'Lint (oxlint)', result: '0 errors, 14 warnings (React effect and fast-refresh rules)', ok: false },
  { check: 'Automated tests', result: 'None in the project', ok: false },
  { check: 'Home page load (4x slower CPU, 9 Mbps)', result: 'First paint 3.5 s -> 2.2 s on desktop and 1.8 s on a phone-sized screen', ok: true },
  { check: 'Outdated packages', result: '2 minor updates available (@react-three/postprocessing, oxlint)', ok: true },
  { check: 'Tracking (analytics)', result: 'First-party, cookie-free page views and events saved to Supabase; no IPs stored; Do Not Track, admin, bots and localhost excluded', ok: true },
  { check: 'Secrets in the repository', result: 'None found; only the public Supabase publishable key is committed', ok: true },
]

export const AREAS = ['Security', 'Tracking & privacy', 'SEO', 'Performance', 'Accessibility', 'Mobile & responsive', 'Code & process']
export const SEVERITIES = ['high', 'medium', 'low', 'info']

// status: 'open' needs action, 'fixed' was resolved, 'pass' is a check that came out fine.
export const FINDINGS = [
  // ---- Security
  {
    id: 'SEC-1',
    area: 'Security',
    severity: 'medium',
    status: 'open',
    title: 'Write access is granted to any signed-in user',
    detail: 'The policies on site_content, enquiries and resources allow every authenticated user to read and write (using (true)). That is only safe while the admin account is the only account.',
    action: 'In Supabase turn off "Allow new users to sign up" and confirm there is a single user. Better: restrict the policies to your user id or email so a future extra user cannot edit the site.',
  },
  {
    id: 'SEC-2',
    area: 'Security',
    severity: 'medium',
    status: 'open',
    title: 'Contact form can be spammed',
    detail: 'Anyone can insert into the enquiries table with the public key. The only defence is a hidden honeypot field, so a script that calls the API directly is not stopped.',
    action: 'Add a CAPTCHA such as Cloudflare Turnstile checked by an edge function, or rate-limit inserts per IP.',
  },
  {
    id: 'SEC-3',
    area: 'Security',
    severity: 'low',
    status: 'open',
    title: 'No security headers or Content-Security-Policy',
    detail: 'The site is static and sets no CSP, X-Frame-Options or Referrer-Policy of its own. These come from the host.',
    action: 'Configure headers at the host (CSP limited to self, Supabase, Google Fonts and GitHub API; frame-ancestors none).',
  },
  {
    id: 'SEC-4',
    area: 'Security',
    severity: 'low',
    status: 'open',
    title: 'Visitor counter can be inflated',
    detail: 'The "people here" count uses a public Realtime channel, so anyone can join it from a script and push the number up.',
    action: 'Acceptable for a vanity counter. Do not use the number for anything that matters.',
  },
  {
    id: 'SEC-9',
    area: 'Security',
    severity: 'low',
    status: 'open',
    title: 'Like counter can be inflated',
    detail: 'The "Like this portfolio" button allows one like per browser, but the limit is only a flag in the visitor\'s own storage. Anyone calling the API directly can add likes.',
    action: 'Fine for a vanity counter. If it ever matters, count likes through an edge function with rate limiting.',
  },
  {
    id: 'SEC-5',
    area: 'Security',
    severity: 'low',
    status: 'open',
    title: 'GitHub Fetch is limited to 60 requests an hour',
    detail: 'The Resources editor calls GitHub unauthenticated from the browser, so heavy use hits the rate limit and Fetch fails until the hour resets.',
    action: 'Wait it out, or move the call to a Supabase edge function using a GitHub token.',
  },
  {
    id: 'SEC-6',
    area: 'Security',
    severity: 'info',
    status: 'pass',
    title: 'Row-level security is on for every table',
    detail: 'admin_state is private to its owner; enquiries accept inserts only from the public; resources and site_content are readable by the public only when published or by design.',
    action: '',
  },
  {
    id: 'SEC-7',
    area: 'Security',
    severity: 'info',
    status: 'pass',
    title: 'Markdown from Resources is sanitised',
    detail: 'Article bodies are rendered with marked and cleaned with DOMPurify before display; external links open with rel="noopener noreferrer".',
    action: '',
  },
  {
    id: 'SEC-8',
    area: 'Security',
    severity: 'info',
    status: 'pass',
    title: 'Sign-out clears the cached admin data',
    detail: 'The task data cached in the browser is removed when you sign out, so a shared computer does not keep it.',
    action: '',
  },

  // ---- Tracking & privacy
  {
    id: 'TRK-1',
    area: 'Tracking & privacy',
    severity: 'info',
    status: 'pass',
    title: 'Analytics is first-party and cookie-free',
    detail: 'Page views and a few events (contact form sent, email click, outside link click) are saved to your own Supabase table. No cookies, no IP address, no third-party scripts. The only identifier is a random id in sessionStorage that disappears when the tab closes. Do Not Track, automated browsers, localhost, the admin and browsers you exclude are not recorded.',
    action: '',
  },
  {
    id: 'TRK-2',
    area: 'Tracking & privacy',
    severity: 'medium',
    status: 'open',
    title: 'No privacy notice describes the tracking',
    detail: 'The site collects contact form messages and visit statistics, but has no privacy page saying what is collected, why, where it is kept and how to ask for deletion. Cookie-free analytics usually needs no consent banner, but visitors in the EU, UK and similar regions should still be told.',
    action: 'Add a short Privacy page (what is collected, Supabase as the processor, retention period, contact email) and link it from the footer. Have the wording checked if you serve regulated markets.',
  },
  {
    id: 'TRK-3',
    area: 'Tracking & privacy',
    severity: 'low',
    status: 'open',
    title: 'Analytics rows can be forged or flooded',
    detail: 'Anyone with the public key can insert analytics rows, so a script could add fake visits or fill the table. The numbers are indicative, not audited.',
    action: 'Fine for a portfolio. If it matters, route inserts through an edge function with rate limiting, or purge suspicious sessions.',
  },
  {
    id: 'TRK-4',
    area: 'Tracking & privacy',
    severity: 'low',
    status: 'open',
    title: 'Analytics is totalled in the browser and never deleted',
    detail: 'The admin Analytics page downloads up to 10,000 of the latest rows and counts them in the browser, and rows are kept forever. That is fine at low traffic but slows down and under-counts as the table grows.',
    action: 'Move the counting into SQL views or a function, and delete rows older than about 13 months with a scheduled job.',
  },
  {
    id: 'TRK-5',
    area: 'Tracking & privacy',
    severity: 'low',
    status: 'open',
    title: 'Counts are visits, not unique people, and there is no search-keyword data',
    detail: 'Because no persistent id is kept, a returning person is counted again on every visit. Google Search Console is not connected, so you cannot see which search terms bring people in.',
    action: 'Verify the site in Google Search Console and submit the sitemap once it exists. Add Google Analytics or an ad pixel only if you need ad reporting, and add a consent banner at that point.',
  },
  {
    id: 'TRK-6',
    area: 'Tracking & privacy',
    severity: 'info',
    status: 'open',
    title: 'Run the updated schema.sql to switch tracking on',
    detail: 'The analytics_events table is created by supabase/schema.sql. Until it is run, the tracker fails silently and the Analytics page shows an error.',
    action: 'Run the latest supabase/schema.sql in the Supabase SQL Editor, then open the live site once and check the Analytics page.',
  },

  // ---- SEO
  {
    id: 'SEO-1',
    area: 'SEO',
    severity: 'high',
    status: 'open',
    title: 'Home page has no meta description, Open Graph or Twitter tags',
    detail: 'index.html only sets a title. Search results and link previews (LinkedIn, WhatsApp, Slack) will show a plain or guessed snippet and no image.',
    action: 'Add a description, canonical URL, og:title, og:description, og:image and twitter:card to index.html.',
  },
  {
    id: 'SEO-2',
    area: 'SEO',
    severity: 'high',
    status: 'open',
    title: 'No robots.txt or sitemap.xml',
    detail: 'public/ contains only icons. Crawlers get no sitemap and no explicit guidance (for example to keep /admin/ out).',
    action: 'Add public/robots.txt (disallow /admin/) and a sitemap.xml listing /, /resources/ and /tools/.',
  },
  {
    id: 'SEO-3',
    area: 'SEO',
    severity: 'medium',
    status: 'open',
    title: 'Resources articles are not separately indexable',
    detail: 'Articles live at /resources/#/slug and are drawn in the browser. Search engines treat everything after # as one page, and each article\'s title and description are set by JavaScript.',
    action: 'Pre-render each article to its own static page (/resources/slug/) at build time, or serve it from a host that supports rewrites, and list them in the sitemap.',
  },
  {
    id: 'SEO-4',
    area: 'SEO',
    severity: 'low',
    status: 'open',
    title: 'No structured data',
    detail: 'There is no JSON-LD (Person, WebSite or Article) to help search engines understand the pages.',
    action: 'Add Person/WebSite JSON-LD to the home page and Article JSON-LD to Resources articles.',
  },

  // ---- Performance
  {
    id: 'PERF-1',
    area: 'Performance',
    severity: 'medium',
    status: 'fixed',
    title: 'Home page waits up to 2.5 seconds for Supabase before rendering',
    detail: 'The home page used to wait up to 2.5 seconds for Supabase before drawing. It now draws straight away from the last saved copy of the content and refreshes that copy in the background.',
    action: '',
  },
  {
    id: 'PERF-2',
    area: 'Performance',
    severity: 'low',
    status: 'open',
    title: '3D logo bundle is about 1 MB',
    detail: 'The 3D scene (about 280 KB over the wire) now loads after the page has drawn and the browser is idle, and data-saver and 2G visitors get the flat logo instead. It is still the biggest single download on the home page.',
    action: 'Optional: skip the 3D scene on small phones too.',
  },
  {
    id: 'PERF-3',
    area: 'Performance',
    severity: 'low',
    status: 'fixed',
    title: 'Supabase client (~210 KB) ships to every public page',
    detail: 'The Supabase client (about 200 KB) now loads after the home page has drawn, for the visitor count, likes, tracking and the contact form, instead of in the first bundle.',
    action: '',
  },
  {
    id: 'PERF-4',
    area: 'Performance',
    severity: 'low',
    status: 'fixed',
    title: 'Unused assets and a large logo file',
    detail: 'Unused template images were removed, and the logo shown in the header, footer and admin is now a small 8 KB file instead of the 129 KB original (which is still used by the 3D scene, recompressed to about 86 KB).',
    action: '',
  },
  {
    id: 'PERF-5',
    area: 'Performance',
    severity: 'info',
    status: 'pass',
    title: 'Heavy tool libraries load only when needed',
    detail: 'PDF, HEIC, TIFF and background-removal code is split into separate chunks and downloads only when a visitor opens that tool.',
    action: '',
  },

  // ---- Accessibility
  {
    id: 'A11Y-1',
    area: 'Accessibility',
    severity: 'medium',
    status: 'open',
    title: 'Colour contrast has not been measured',
    detail: 'Muted grey text and small mono labels on the dark navy background (admin and public) were not checked against WCAG AA.',
    action: 'Run a contrast check (axe or Lighthouse) and raise the muted colour where it falls below 4.5:1.',
  },
  {
    id: 'A11Y-2',
    area: 'Accessibility',
    severity: 'low',
    status: 'open',
    title: 'Drag-and-drop board relies on pointer and keyboard sensors only',
    detail: 'Keyboard dragging is supported, but screen-reader announcements for moves were not reviewed.',
    action: 'Test the task board with a screen reader and add live announcements if missing.',
  },
  {
    id: 'A11Y-3',
    area: 'Accessibility',
    severity: 'info',
    status: 'pass',
    title: 'Motion preferences, labels and form errors are handled',
    detail: 'prefers-reduced-motion is respected in the animations; every image has alt text; form fields have labels and errors use role="alert".',
    action: '',
  },

  // ---- Mobile & responsive
  {
    id: 'MOB-1',
    area: 'Mobile & responsive',
    severity: 'info',
    status: 'pass',
    title: 'No sideways scrolling on any page',
    detail: 'The home page, Resources, Free Tools and every admin page were checked at 375, 768, 900, 1024 and 1180 pixels wide. None is wider than the screen. The public pages and the admin both have a menu button on phones and small tablets.',
    action: '',
  },
  {
    id: 'MOB-2',
    area: 'Mobile & responsive',
    severity: 'low',
    status: 'open',
    title: 'Only checked in a desktop browser emulating phones',
    detail: 'The layouts were tested in Chrome with a phone-sized screen and touch on, not on real iPhones and Android phones. Safari in particular can differ (address-bar height, 3D transforms, fixed elements).',
    action: 'Open the live site on an iPhone and an Android phone and walk through each page once.',
  },

  // ---- Code & process
  {
    id: 'CODE-1',
    area: 'Code & process',
    severity: 'medium',
    status: 'open',
    title: 'No automated tests or CI',
    detail: 'There are no unit or end-to-end tests and no GitHub Action that builds and lints each pull request. Regressions depend on manual checking.',
    action: 'Add a GitHub Actions workflow (install, lint, build) and a few tests for the store reducer and the repo-draft generator.',
  },
  {
    id: 'CODE-2',
    area: 'Code & process',
    severity: 'medium',
    status: 'open',
    title: 'Several stacked branches and pull requests',
    detail: 'Recent work was pushed as a chain of branches that build on each other, and main still holds the first commit with all Free Tools. Merging out of order will cause conflicts.',
    action: 'Merge the newest branch that contains everything, close the older pull requests, and delete merged branches.',
  },
  {
    id: 'CODE-3',
    area: 'Code & process',
    severity: 'medium',
    status: 'open',
    title: 'Database setup is a manual script',
    detail: 'supabase/schema.sql is run by hand and re-run after each change. There is no migration history, so it is hard to know which version a database is on.',
    action: 'Move to Supabase migrations (supabase db push) so every change is versioned.',
  },
  {
    id: 'CODE-4',
    area: 'Code & process',
    severity: 'low',
    status: 'open',
    title: 'README is still the Vite template',
    detail: 'It does not explain how to run the project, the Supabase setup, the admin sign-in or the deploy steps.',
    action: 'Rewrite the README with setup, environment variables, schema steps and the page map.',
  },
  {
    id: 'CODE-5',
    area: 'Code & process',
    severity: 'low',
    status: 'open',
    title: '14 lint warnings',
    detail: 'Mostly "setState inside an effect" and "fast refresh only works when a file only exports components". They do not break anything today.',
    action: 'Clear them gradually; none block a release.',
  },
  {
    id: 'CODE-6',
    area: 'Code & process',
    severity: 'low',
    status: 'open',
    title: 'Task data is one JSON row with last-write-wins',
    detail: 'The whole task manager is saved as a single record. Editing on two devices at once keeps only the latest save, and there is no history beyond manual backups.',
    action: 'Export a backup regularly, or move tasks to their own rows with timestamps if you start using it on several devices at once.',
  },
]

const rank = { high: 0, medium: 1, low: 2, info: 3 }
export const sortFindings = (list) => [...list].sort((a, b) => rank[a.severity] - rank[b.severity] || a.id.localeCompare(b.id))

export function summarise(list = FINDINGS) {
  const open = list.filter((f) => f.status === 'open')
  return {
    open: open.length,
    high: open.filter((f) => f.severity === 'high').length,
    medium: open.filter((f) => f.severity === 'medium').length,
    low: open.filter((f) => f.severity === 'low').length,
    passed: list.filter((f) => f.status === 'pass').length,
    fixed: list.filter((f) => f.status === 'fixed').length,
    total: list.length,
  }
}

export function toMarkdown(list = FINDINGS) {
  const s = summarise(list)
  const lines = [
    `# ${AUDIT.title}`,
    '',
    `Date: ${AUDIT.date}`,
    `Scope: ${AUDIT.scope}`,
    `Method: ${AUDIT.method}`,
    '',
    `Open findings: ${s.open} (${s.high} high, ${s.medium} medium, ${s.low} low). Checks passed: ${s.passed}.`,
    '',
    '## Checks run',
    ...EVIDENCE.map((e) => `- ${e.ok ? 'OK' : 'Attention'}: ${e.check} - ${e.result}`),
  ]
  AREAS.forEach((area) => {
    const items = sortFindings(list.filter((f) => f.area === area))
    if (!items.length) return
    lines.push('', `## ${area}`)
    items.forEach((f) => {
      lines.push('', `### ${f.id} [${f.status === 'pass' ? 'pass' : f.severity}] ${f.title}`, f.detail)
      if (f.action) lines.push(`Recommended: ${f.action}`)
    })
  })
  return lines.join('\n')
}
