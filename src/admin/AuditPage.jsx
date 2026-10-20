import { useMemo, useState } from 'react'
import { TbCheck, TbCopy, TbDownload, TbPrinter, TbShieldCheck } from 'react-icons/tb'
import { AREAS, AUDIT, EVIDENCE, FINDINGS, sortFindings, summarise, toMarkdown } from './auditReport'
import { useAdmin } from './ctx'
import { Segmented } from './ui'

const longDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

const SEVERITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low', info: 'Info' }

export default function AuditPage() {
  const { toast } = useAdmin()
  const [area, setArea] = useState('All')
  const [show, setShow] = useState('open')
  const summary = summarise()

  const shown = useMemo(
    () =>
      sortFindings(FINDINGS).filter((f) => (area === 'All' || f.area === area) && (show === 'all' || (show === 'open' ? f.status === 'open' : f.status !== 'open'))),
    [area, show],
  )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown())
      toast('Audit report copied as Markdown')
    } catch {
      toast('Could not copy. Use Download instead.')
    }
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([toMarkdown()], { type: 'text/markdown' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `internal-audit-${AUDIT.date}.md`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  return (
    <div className="adm-page adm-audit">
      <header className="adm-pagehead">
        <div>
          <h1>Internal audit</h1>
          <p className="adm-sub">
            {AUDIT.title} · {longDate(AUDIT.date)}
          </p>
        </div>
        <div className="adm-actions adm-noprint">
          <button type="button" className="adm-btn is-ghost" onClick={copy}>
            <TbCopy aria-hidden="true" /> Copy Markdown
          </button>
          <button type="button" className="adm-btn is-ghost" onClick={download}>
            <TbDownload aria-hidden="true" /> Download
          </button>
          <button type="button" className="adm-btn is-light" onClick={() => window.print()}>
            <TbPrinter aria-hidden="true" /> Print / PDF
          </button>
        </div>
      </header>

      <section className="adm-dcard adm-audit-scope" aria-label="Scope">
        <p>
          <b>Scope.</b> {AUDIT.scope}
        </p>
        <p>
          <b>Method.</b> {AUDIT.method}
        </p>
      </section>

      <div className="adm-audit-stats">
        <div className="adm-dcard is-high">
          <p className="adm-eyebrow">High</p>
          <p className="adm-statnum">{summary.high}</p>
          <small>open</small>
        </div>
        <div className="adm-dcard is-medium">
          <p className="adm-eyebrow">Medium</p>
          <p className="adm-statnum">{summary.medium}</p>
          <small>open</small>
        </div>
        <div className="adm-dcard is-low">
          <p className="adm-eyebrow">Low</p>
          <p className="adm-statnum">{summary.low}</p>
          <small>open</small>
        </div>
        <div className="adm-dcard is-pass">
          <p className="adm-eyebrow">Passed</p>
          <p className="adm-statnum">{summary.passed}</p>
          <small>checks</small>
        </div>
        <div className="adm-dcard">
          <p className="adm-eyebrow">Fixed</p>
          <p className="adm-statnum">{summary.fixed}</p>
          <small>of {summary.total} items</small>
        </div>
      </div>

      <section className="adm-dcard" aria-label="Checks run">
        <header className="adm-dhead">
          <h2>Checks run</h2>
          <span>Evidence behind the findings</span>
        </header>
        <ul className="adm-evidence">
          {EVIDENCE.map((e) => (
            <li key={e.check} className={e.ok ? 'is-ok' : 'is-warn'}>
              <span aria-hidden="true">{e.ok ? <TbCheck /> : '!'}</span>
              <strong>{e.check}</strong>
              <span>{e.result}</span>
              <b className="adm-visually-hidden">{e.ok ? 'OK' : 'Needs attention'}</b>
            </li>
          ))}
        </ul>
      </section>

      <div className="adm-audit-filters adm-noprint">
        <div className="adm-pills" role="group" aria-label="Filter by area">
          {['All', ...AREAS].map((a) => (
            <button key={a} type="button" className={area === a ? 'is-active' : ''} aria-pressed={area === a} onClick={() => setArea(a)}>
              {a}
            </button>
          ))}
        </div>
        <Segmented label="Status" value={show} onChange={setShow} options={[{ id: 'open', label: 'Open' }, { id: 'pass', label: 'Passed' }, { id: 'all', label: 'All' }]} />
      </div>

      <ul className="adm-findings">
        {shown.map((f) => (
          <li key={f.id} className={`is-${f.status === 'pass' ? 'pass' : f.severity}`}>
            <article>
              <header>
                <span className="adm-findid">{f.id}</span>
                <span className={`adm-sev is-${f.status === 'pass' ? 'pass' : f.severity}`}>{f.status === 'pass' ? 'Passed' : f.status === 'fixed' ? 'Fixed' : SEVERITY_LABEL[f.severity]}</span>
                <span className="adm-findarea">{f.area}</span>
              </header>
              <h3>{f.title}</h3>
              <p>{f.detail}</p>
              {f.action && (
                <p className="adm-findaction">
                  <TbShieldCheck aria-hidden="true" /> <span>{f.action}</span>
                </p>
              )}
            </article>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="adm-dempty">Nothing here for that filter.</p>}
    </div>
  )
}
