import { useEffect, useMemo, useState } from 'react'
import { TbChartLine, TbRefresh } from 'react-icons/tb'
import { EXCLUDE_KEY } from '../lib/track'
import { supabase } from '../lib/supabase'
import { useAdmin } from './ctx'
import { addDays, toDateStr } from './store'
import { EmptyState, Segmented } from './ui'

const PAGE = 1000
const MAX_PAGES = 10 // up to 10,000 rows per view; see the audit note on moving this into SQL
const COLUMNS = 'created_at,session_id,type,name,detail,path,referrer,utm_source,utm_medium,utm_campaign,device'

async function loadRows(sinceIso) {
  const rows = []
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await supabase
      .from('analytics_events')
      .select(COLUMNS)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

const tally = (items, key) => {
  const counts = new Map()
  items.forEach((i) => {
    const k = key(i)
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1)
  })
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

const EVENT_LABELS = {
  contact_submit: 'Contact form sent',
  email_click: 'Email link clicked',
  outbound_click: 'Outside link clicked',
}

function TopList({ title, rows, empty, label = (k) => k }) {
  const max = Math.max(1, ...rows.map((r) => r[1]))
  return (
    <section className="adm-dcard adm-toplist" aria-label={title}>
      <header className="adm-dhead">
        <h2>{title}</h2>
      </header>
      {rows.length ? (
        <ul>
          {rows.slice(0, 8).map(([k, n]) => (
            <li key={k}>
              <span className="adm-toplist-bar" style={{ width: `${(n / max) * 100}%` }} aria-hidden="true" />
              <span className="adm-toplist-label">{label(k)}</span>
              <b>{n}</b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="adm-dempty">{empty}</p>
      )}
    </section>
  )
}

export default function AnalyticsPage() {
  const { today } = useAdmin()
  const [days, setDays] = useState('30')
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const [excluded, setExcluded] = useState(() => {
    try {
      return Boolean(localStorage.getItem(EXCLUDE_KEY))
    } catch {
      return false
    }
  })

  useEffect(() => {
    let live = true
    const since = new Date(`${addDays(today, -(Number(days) - 1))}T00:00:00`).toISOString()
    loadRows(since)
      .then((data) => live && (setRows(data), setError('')))
      .catch((e) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [days, today, tick])

  const stats = useMemo(() => {
    const list = rows ?? []
    const views = list.filter((r) => r.type === 'pageview')
    const events = list.filter((r) => r.type === 'event')
    const visits = new Set(views.map((r) => r.session_id))
    const contact = events.filter((e) => e.name === 'contact_submit')
    const dates = Array.from({ length: Number(days) }, (_, i) => addDays(today, i - (Number(days) - 1)))
    const perDay = Object.fromEntries(dates.map((d) => [d, { views: 0, visits: new Set() }]))
    views.forEach((r) => {
      const d = toDateStr(new Date(r.created_at))
      if (perDay[d]) {
        perDay[d].views += 1
        perDay[d].visits.add(r.session_id)
      }
    })
    return {
      views: views.length,
      visits: visits.size,
      perPage: visits.size ? (views.length / visits.size).toFixed(1) : '0',
      contact: contact.length,
      rate: visits.size ? `${((contact.length / visits.size) * 100).toFixed(1)}%` : '0%',
      series: dates.map((d) => ({ date: d, views: perDay[d].views, visits: perDay[d].visits.size })),
      pages: tally(views, (r) => r.path),
      referrers: tally(views, (r) => r.referrer || 'Direct / none'),
      campaigns: tally(views, (r) => (r.utm_source ? `${r.utm_source}${r.utm_campaign ? ` / ${r.utm_campaign}` : ''}` : '')),
      devices: tally(views, (r) => r.device),
      events: tally(events, (r) => (EVENT_LABELS[r.name] ?? r.name) + (r.detail && r.name !== 'contact_submit' ? ` · ${r.detail}` : '')),
    }
  }, [rows, days, today])

  const maxDay = Math.max(1, ...stats.series.map((d) => d.views))

  const toggleExclude = (on) => {
    try {
      if (on) localStorage.setItem(EXCLUDE_KEY, '1')
      else localStorage.removeItem(EXCLUDE_KEY)
    } catch {
      // The choice just is not saved.
    }
    setExcluded(on)
  }

  return (
    <div className="adm-page adm-analytics">
      <header className="adm-pagehead">
        <div>
          <h1>Analytics</h1>
          <p className="adm-sub">Visits to your public site, saved in your own Supabase. No cookies and no IP addresses.</p>
        </div>
        <div className="adm-actions">
          <Segmented label="Period" value={days} onChange={(v) => { setRows(null); setDays(v) }} options={[{ id: '7', label: '7 days' }, { id: '30', label: '30 days' }, { id: '90', label: '90 days' }]} />
          <button type="button" className="adm-btn is-ghost" onClick={() => { setRows(null); setTick((t) => t + 1) }}>
            <TbRefresh aria-hidden="true" /> Refresh
          </button>
        </div>
      </header>

      {error && (
        <p className="adm-banner" role="alert">
          Could not load analytics: {error}. Make sure the latest supabase/schema.sql has been run.
        </p>
      )}

      {rows && rows.length === 0 && !error && (
        <EmptyState icon={TbChartLine} title="No visits recorded yet">
          Visits appear here once people open the live site. Your own browser is not counted while the option below is on.
        </EmptyState>
      )}

      <div className="adm-statrow">
        <div className="adm-dcard">
          <p className="adm-eyebrow">Visits</p>
          <p className="adm-statnum">{rows ? stats.visits : '…'}</p>
          <small>one per browsing session</small>
        </div>
        <div className="adm-dcard">
          <p className="adm-eyebrow">Page views</p>
          <p className="adm-statnum">{rows ? stats.views : '…'}</p>
          <small>{stats.perPage} per visit</small>
        </div>
        <div className="adm-dcard">
          <p className="adm-eyebrow">Messages sent</p>
          <p className="adm-statnum">{rows ? stats.contact : '…'}</p>
          <small>contact form</small>
        </div>
        <div className="adm-dcard">
          <p className="adm-eyebrow">Conversion</p>
          <p className="adm-statnum">{rows ? stats.rate : '…'}</p>
          <small>visits that sent a message</small>
        </div>
        <div className="adm-dcard">
          <p className="adm-eyebrow">Rows loaded</p>
          <p className="adm-statnum">{rows ? rows.length : '…'}</p>
          <small>{rows && rows.length >= PAGE * MAX_PAGES ? 'limit reached' : 'in this period'}</small>
        </div>
      </div>

      <section className="adm-dcard" aria-label="Page views per day">
        <header className="adm-dhead">
          <h2>Page views per day</h2>
          <span>Bars are page views; the hover text also shows visits</span>
        </header>
        <div className="adm-daybars" role="img" aria-label={`Page views per day over the last ${days} days`} style={{ gridTemplateColumns: `repeat(${stats.series.length}, 1fr)` }}>
          {stats.series.map((d) => (
            <span key={d.date} title={`${d.date}: ${d.views} views, ${d.visits} visits`} className={d.date === today ? 'is-today' : ''}>
              <i style={{ height: `${(d.views / maxDay) * 100}%` }} />
            </span>
          ))}
        </div>
      </section>

      <div className="adm-analytics-grid">
        <TopList title="Top pages" rows={stats.pages} empty="No page views yet." />
        <TopList title="Where visitors came from" rows={stats.referrers} empty="No visits yet." />
        <TopList title="Devices" rows={stats.devices} empty="No visits yet." label={(k) => k[0].toUpperCase() + k.slice(1)} />
        <TopList title="Actions" rows={stats.events} empty="No contact messages or link clicks yet." />
        <TopList title="Campaigns (UTM)" rows={stats.campaigns} empty="No tagged links yet. Add ?utm_source=linkedin to a link you share." />
      </div>

      <label className="adm-exclude">
        <input type="checkbox" checked={excluded} onChange={(e) => toggleExclude(e.target.checked)} />
        <span>
          Do not count visits from this browser
          <small>Keeps your own testing out of the numbers. Turn it off to test tracking yourself.</small>
        </span>
      </label>
    </div>
  )
}
