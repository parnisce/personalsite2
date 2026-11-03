import { useCallback, useEffect, useRef, useState } from 'react'
import { TbAlertTriangle, TbArrowRight, TbCheck, TbChecklist, TbCopy, TbEye, TbFlame, TbLoader2, TbPrinter, TbTarget, TbX } from 'react-icons/tb'
import { Footer, Header } from '../components/SiteChrome'
import { BOOKING_URL } from '../data'
import { analyze, gradeOf, labelOf, scoreColour, severityColour } from './analyze'
import { runScan, STEPS } from './engine'
import '../App.css'
import './roast.css'

const CHECKS = [
  'First impression',
  'Design & style',
  'Content & copy',
  'Conversion & CTAs',
  'Forms & CRM connection',
  'Chatbot / AI agent',
  'Tracking & ad pixels',
  'Google stack',
  'SEO fundamentals',
  'AI search visibility',
  'Authority & backlinks',
  'Performance',
  'Mobile experience',
  'Security',
  'Trust & credibility',
  'Accessibility',
  'Technical health',
]

const QUIPS = {
  home: 'Knocking on the front door…',
  basics: 'Reading the fine print in robots.txt…',
  crawl: 'Snooping through every room…',
  links: "Clicking every link so your visitors don't have to…",
  infra: "Checking who's allowed to send email as you…",
  probes: 'Rattling the back windows…',
  speed: 'Timing how long your visitors wait…',
  authority: 'Asking the internet who vouches for you…',
  ai: 'The AI is looking at your site… and it has opinions.',
}

// "yoursite.com", "https://www.yoursite.com/page" -> { origin, host }, or null when it isn't a public website.
function parseTarget(input) {
  let value = input.trim()
  if (!value) return null
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`
  try {
    const u = new URL(value)
    const h = u.hostname.toLowerCase()
    const bad =
      (u.protocol !== 'https:' && u.protocol !== 'http:') ||
      (u.port && u.port !== '80' && u.port !== '443') ||
      u.username ||
      u.password ||
      !h.includes('.') ||
      h.endsWith('.') ||
      /^[\d.]+$/.test(h) ||
      h.includes(':') ||
      /(^|\.)(localhost|local|internal|intranet|lan|home|corp|test|invalid|example)$/.test(h)
    if (bad) return null
    return { origin: `https://${u.host}`, host: u.hostname.replace(/^www\./, '') }
  } catch {
    return null
  }
}

const statusClass = (s) => (s >= 400 || s === 0 ? 'is-bad' : s >= 300 ? 'is-warn' : 'is-ok')

function Progress({ run }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])
  const done = run.steps.filter((s) => ['done', 'skip', 'fail'].includes(s.state)).length
  const running = run.steps.find((s) => s.state === 'run')
  const pct = Math.min(99, Math.round(((done + (running ? 0.5 : 0)) / run.steps.length) * 100))

  return (
    <section className="rm-run" aria-live="polite">
      <div className="rm-run-head">
        <p className="rm-run-title">
          Analysis in progress · <strong>{run.host}</strong>
        </p>
        <p className="rm-run-meta">
          {pct}% · {Math.round((now - run.startedAt) / 1000)}s elapsed
        </p>
      </div>
      <div className="rm-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <p className="rm-quip">{QUIPS[running?.id] ?? 'Warming up the flamethrower…'}</p>

      <div className="rm-run-grid">
        <ol className="rm-steps">
          {run.steps.map((s) => (
            <li key={s.id} className={`is-${s.state}`}>
              <span className="rm-step-icon" aria-hidden="true">
                {s.state === 'done' ? <TbCheck /> : s.state === 'fail' ? <TbX /> : s.state === 'run' ? <TbLoader2 className="rm-spin" /> : null}
              </span>
              <span>
                {s.label}
                <small>{s.state === 'wait' ? 'Pending' : s.state === 'run' ? `In progress…${s.note ? ` · ${s.note}` : ''}` : s.state === 'skip' ? `Skipped${s.note ? ` · ${s.note}` : ''}` : (s.note ?? (s.state === 'fail' ? 'Failed' : 'Done'))}</small>
              </span>
            </li>
          ))}
        </ol>

        <div className="rm-live">
          <p className="rm-live-head">
            Live requests <span>{run.count}</span>
          </p>
          {run.shot && <img className="rm-shot" src={run.shot} alt="Phone screenshot of the site" />}
          <ul>
            {run.hits.slice(0, 12).map((h, i) => (
              <li key={`${run.count - i}`}>
                <b className={statusClass(h.status)}>{h.status || '—'}</b>
                <span>{h.label}</span>
                {h.ms != null && <em>{h.ms}ms</em>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function ScoreRing({ score, size = 168 }) {
  const r = (size - 16) / 2
  const c = 2 * Math.PI * r
  const colour = scoreColour(score)
  return (
    <svg className="rm-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Score ${score} out of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={colour}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="currentColor" className="rm-ring-num">
        {score}
      </text>
    </svg>
  )
}

function Severity({ level }) {
  return (
    <span className="rm-sev" style={{ '--sev': severityColour[level] }}>
      {level}
    </span>
  )
}

function CheckCard({ check }) {
  const [open, setOpen] = useState(false)
  const colour = scoreColour(check.score)
  return (
    <article className={`rm-check${open ? ' is-open' : ''}`}>
      <button type="button" className="rm-check-bar" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="rm-check-score" style={{ color: colour, borderColor: colour }}>
          {check.score ?? '–'}
        </span>
        <span className="rm-check-main">
          <strong>{check.title}</strong>
          <em>{check.roast}</em>
        </span>
        <span className="rm-check-count">{check.findings.length ? `${check.findings.length} to fix` : check.score == null ? 'Not scored' : 'All clear'}</span>
        <span className="rm-plus" aria-hidden="true" />
      </button>
      {open && (
        <div className="rm-check-body">
          {check.analysis && <p className="rm-analysis">{check.analysis}</p>}
          {check.examples?.length > 0 && (
            <ul className="rm-examples">
              {check.examples.map((e, i) => (
                <li key={i}>{typeof e === 'string' ? e : JSON.stringify(e)}</li>
              ))}
            </ul>
          )}
          {check.findings.length > 0 && (
            <ul className="rm-findings">
              {check.findings.map((f, i) => (
                <li key={i}>
                  <Severity level={f.severity} />
                  <div>
                    <p>{f.issue}</p>
                    <p className="rm-fix">
                      <TbArrowRight aria-hidden="true" /> {f.fix}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {check.strengths.length > 0 && (
            <ul className="rm-strengths">
              {check.strengths.map((s, i) => (
                <li key={i}>
                  <TbCheck aria-hidden="true" /> {s}
                </li>
              ))}
            </ul>
          )}
          {check.facts?.length > 0 && (
            <dl className="rm-facts">
              {check.facts.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {check.note && <p className="rm-note">{check.note}</p>}
        </div>
      )}
    </article>
  )
}

function Report({ report, data }) {
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/roast?url=${encodeURIComponent(data.host)}`
  const groups = [...new Set(report.checks.map((c) => c.group))]

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link', link)
    }
  }

  return (
    <div className="rm-report">
      <section className="rm-score-card">
        <ScoreRing score={report.overall} />
        <div className="rm-score-main">
          <p className="eyebrow">Overall score</p>
          <p className="rm-grade" style={{ color: scoreColour(report.overall) }}>
            {gradeOf(report.overall)} · {labelOf(report.overall)}
          </p>
          <h2>{report.verdict}</h2>
          {report.tech.length > 0 && <p className="rm-tech">Built with {report.tech.join(', ')}</p>}
          <div className="rm-share">
            <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
              <TbCopy aria-hidden="true" /> {copied ? 'Link copied' : 'Copy link'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()}>
              <TbPrinter aria-hidden="true" /> Print / save as PDF
            </button>
          </div>
        </div>
      </section>

      <section className="rm-verdict">
        <p className="eyebrow">The verdict</p>
        <p>{report.summary}</p>
      </section>

      {report.fixes.length > 0 && (
        <section className="rm-fixes">
          <h3>Fix these first</h3>
          <ol>
            {report.fixes.map((f, i) => (
              <li key={i}>
                <Severity level={f.severity} />
                <div>
                  <p>{f.issue}</p>
                  <p className="rm-fix">
                    <TbArrowRight aria-hidden="true" /> {f.fix}
                  </p>
                  <small>{f.check}</small>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="rm-measured">
        <h3>What we measured</h3>
        {groups.map((g) => (
          <div key={g} className="rm-group">
            <p className="rm-group-name">{g}</p>
            {report.checks
              .filter((c) => c.group === g)
              .map((c) => (
                <CheckCard key={c.id} check={c} />
              ))}
          </div>
        ))}
      </section>

      <section className="rm-cta">
        <h3>Want these fixed?</h3>
        <p>Websites, funnels, automation and AI follow-up, handled by one person. Book a call and I&apos;ll go through this report with you.</p>
        <a className="btn btn-primary" href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
          Book a call <TbArrowRight aria-hidden="true" />
        </a>
      </section>
    </div>
  )
}

// A sample report shown next to the form while nothing has been scanned yet.
function PreviewCard() {
  return (
    <div className="rm-preview" aria-hidden="true">
      <div className="rm-preview-bar">
        <i />
        <i />
        <i />
        <span>cyrylbitangcol.com/roast?url=yoursite.com</span>
      </div>
      <div className="rm-preview-body">
        <div className="rm-preview-top">
          <div>
            <p>Overall score</p>
            <strong>
              92<small>/100</small>
            </strong>
          </div>
          <span className="rm-preview-grade">A</span>
        </div>
        <blockquote>“Clear offer, one obvious next step and proof everywhere. Visitors know exactly where to click.”</blockquote>
        <div className="rm-preview-row">
          <span>
            <TbEye /> First impression
          </span>
          <b>94</b>
        </div>
        <div className="rm-preview-row">
          <span>
            <TbTarget /> Conversion &amp; CTAs
          </span>
          <b>89</b>
        </div>
        <div className="rm-preview-more">
          <span>
            <TbChecklist /> +15 more checks
          </span>
          <em>All free</em>
        </div>
      </div>
    </div>
  )
}

export default function RoastPage() {
  const [url, setUrl] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [state, setState] = useState({ phase: 'idle' })
  const top = useRef(null)

  useEffect(() => {
    document.title = 'Roast My Website: Free Website Audit | Cyryl Bitangcol'
  }, [])

  const start = useCallback(async (input) => {
    const target = parseTarget(input)
    if (!target) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setState({ phase: 'running', host: target.host, steps: STEPS.map((s) => ({ ...s, state: 'wait' })), hits: [], count: 0, startedAt: Date.now() })
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const running = (fn) => setState((s) => (s.phase === 'running' ? fn(s) : s))
    try {
      const data = await runScan(target.origin, target.host, {
        step: (id, st, note) => running((s) => ({ ...s, steps: s.steps.map((x) => (x.id === id ? { ...x, state: st, note } : x)) })),
        hit: (h) => running((s) => ({ ...s, hits: [h, ...s.hits].slice(0, 30), count: s.count + 1, shot: h.shot ?? s.shot })),
      })
      setState({ phase: 'done', data, report: analyze(data) })
      window.history.replaceState(null, '', `?url=${encodeURIComponent(target.host)}`)
    } catch (e) {
      running((s) => ({ ...s, phase: 'error', message: e instanceof Error ? e.message : 'The scan failed.' }))
    }
  }, [])

  // /roast?url=yoursite.com starts straight away.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('url')
    if (!q) return undefined
    const t = setTimeout(() => {
      setUrl(q)
      start(q)
    })
    return () => clearTimeout(t)
  }, [start])

  const idle = state.phase === 'idle'
  const busy = state.phase === 'running'

  return (
    <div className="rm-page">
      <Header active="" onHome={false} />
      <main className="shell rm-main" ref={top}>
        <div className={`rm-top${idle ? ' has-preview' : ''}`}>
        <section className="rm-hero">
          <p className="eyebrow">Free website audit</p>
          <h1>
            Does your website
            <br />
            <span className="accent">deserve its traffic?</span>
          </h1>
          {idle && <p className="lead">Get a brutal (but fair) roast of your site in about two minutes. Score out of 100, every flaw found, concrete fixes. Zero BS.</p>}

          <form
            className={`rm-form${invalid ? ' is-invalid' : ''}`}
            onSubmit={(e) => {
              e.preventDefault()
              if (!busy) start(url)
            }}
          >
            <label htmlFor="roast-url" className="sr-only">
              Your website
            </label>
            <TbFlame className="rm-form-icon" aria-hidden="true" />
            <input id="roast-url" value={url} onChange={(e) => (setUrl(e.target.value), setInvalid(false))} placeholder="https://yoursite.com" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck="false" disabled={busy} />
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Roasting…' : 'Get roasted!'} <TbFlame aria-hidden="true" />
            </button>
          </form>
          {invalid && (
            <p className="rm-error" role="alert">
              <TbAlertTriangle aria-hidden="true" /> Enter a public website address, like yoursite.com.
            </p>
          )}
          <p className="rm-fine">Free, no signup · nothing stored · full report, nothing locked</p>
        </section>
        {idle && <PreviewCard />}
        </div>

        {busy && <Progress run={state} />}

        {state.phase === 'error' && (
          <section className="rm-fail" role="alert">
            <TbAlertTriangle aria-hidden="true" />
            <div>
              <h2>The scan couldn&apos;t finish</h2>
              <p>{state.message}</p>
            </div>
          </section>
        )}

        {state.phase === 'done' && <Report report={state.report} data={state.data} />}

        {idle && (
          <section className="rm-what">
            <p className="eyebrow">What gets roasted</p>
            <ul className="rm-chips">
              {CHECKS.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="rm-how">
              We load your site like a visitor and a search engine would, crawl up to 15 pages, test the links, read the security headers and DNS, and run Google&apos;s own speed test. Then an AI reviewer
              looks at the screenshots and tells you, bluntly, what&apos;s costing you leads. We never submit your forms or log in to anything.
            </p>
          </section>
        )}
      </main>
      <Footer onHome={false} />
    </div>
  )
}
