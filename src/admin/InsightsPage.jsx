import { useMemo, useState } from 'react'
import { TbChevronLeft, TbChevronRight } from 'react-icons/tb'
import { useAdmin } from './ctx'
import { DAY_LABELS, addDays, dayTotals, formatDuration, loggedStreak, localDay, longDate, parseDate, toDateStr, topCategory, weekdayIndex } from './store'
import { CategoryDot, Segmented } from './ui'

const mondayOf = (date) => addDays(date, -weekdayIndex(date))
const monthName = (date, opts) => parseDate(date).toLocaleDateString('en-GB', opts)
const hm = (minutes) => `${Math.floor(minutes / 60)}H ${String(minutes % 60).padStart(2, '0')}M`

// The first and last day of the period, and a label for it.
function periodFor(range, offset, today) {
  if (range === 'week') {
    const start = addDays(mondayOf(today), offset * 7)
    const end = addDays(start, 6)
    const a = parseDate(start)
    const b = parseDate(end)
    const label = a.getMonth() === b.getMonth() ? `${a.getDate()}–${monthName(end, { day: 'numeric', month: 'short' })}` : `${monthName(start, { day: 'numeric', month: 'short' })} – ${monthName(end, { day: 'numeric', month: 'short' })}`
    return { start, end, label, name: 'This week' }
  }
  const t = parseDate(today)
  if (range === 'month') {
    const first = new Date(t.getFullYear(), t.getMonth() + offset, 1)
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
    const start = toDateStr(first)
    return { start, end: toDateStr(last), label: monthName(start, { month: 'long', year: 'numeric' }), name: monthName(start, { month: 'long' }) }
  }
  const year = t.getFullYear() + offset
  return { start: `${year}-01-01`, end: `${year}-12-31`, label: String(year), name: String(year) }
}

// Mon-first columns of seven days between two dates (days outside the range are null).
function weekColumns(start, end) {
  const cols = []
  let monday = mondayOf(start)
  while (monday <= end) {
    cols.push(Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((d) => (d >= start && d <= end ? d : null)))
    monday = addDays(monday, 7)
  }
  return cols
}

function Heatmap({ columns, days, max, today, selected, onSelect, cats, label, monthLabels = false }) {
  return (
    <div className={`adm-heat${monthLabels ? ' is-year' : ' is-rows'}`} role="group" aria-label={label}>
      {monthLabels && (
        <div className="adm-heat-months" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }} aria-hidden="true">
          {columns.map((col, i) => {
            const first = col.find(Boolean)
            const show = first && (i === 0 || parseDate(first).getMonth() !== parseDate(columns[i - 1].find(Boolean) ?? first).getMonth())
            return <span key={i}>{show ? monthName(first, { month: 'short' }).toUpperCase() : ''}</span>
          })}
        </div>
      )}
      <div className="adm-heat-grid" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
        {columns.map((col, i) => (
          <div key={i} className="adm-heat-col">
            {col.map((date, r) => {
              if (!date) return <span key={r} className="adm-heat-cell is-blank" />
              const d = days[date]
              const top = topCategory(d?.cats)
              const color = top && top !== 'none' ? cats[top]?.color : 'var(--muted)'
              const future = date > today
              return (
                <button
                  key={r}
                  type="button"
                  className={`adm-heat-cell${d?.total ? ' has-time' : ''}${date === today ? ' is-today' : ''}${date === selected ? ' is-selected' : ''}${future ? ' is-future' : ''}`}
                  style={d?.total ? { '--c': color, '--a': 0.28 + 0.72 * Math.min(1, d.total / max) } : undefined}
                  title={`${longDate(date)}: ${d?.total ? formatDuration(d.total) : 'nothing logged'}`}
                  aria-label={`${longDate(date)}: ${d?.total ? formatDuration(d.total) : 'nothing logged'}`}
                  aria-pressed={date === selected}
                  onClick={() => onSelect(date)}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function InsightsPage() {
  const { state, today, now } = useAdmin()
  const [range, setRange] = useState('month')
  const [offset, setOffset] = useState(0)
  const [picked, setPicked] = useState(null)

  const cats = useMemo(() => Object.fromEntries(state.categories.map((c) => [c.id, c])), [state.categories])
  const days = useMemo(() => dayTotals(state, now), [state, now])
  const period = periodFor(range, offset, today)
  const isCurrent = offset === 0
  const upTo = period.end < today ? period.end : today // days that have happened
  const selected = picked && picked >= period.start && picked <= period.end ? picked : isCurrent ? today : period.end

  const data = useMemo(() => {
    const inPeriod = Object.entries(days).filter(([d]) => d >= period.start && d <= period.end)
    const catTime = {}
    let total = 0
    let best = null
    inPeriod.forEach(([date, d]) => {
      total += d.total
      Object.entries(d.cats).forEach(([c, s]) => {
        catTime[c] = (catTime[c] ?? 0) + s
      })
      if (!best || d.total > best.total) best = { date, total: d.total }
    })
    const elapsed = Math.max(0, Math.round((parseDate(upTo) - parseDate(period.start)) / 86400000) + 1)
    const doneTasks = state.tasks.filter((t) => t.completedAt && localDay(t.completedAt) >= period.start && localDay(t.completedAt) <= period.end).length
    const nights = state.sleep.filter((n) => n.date >= period.start && n.date <= period.end)
    return {
      total,
      catTime,
      best,
      active: inPeriod.filter(([, d]) => d.total > 0).length,
      elapsed,
      doneTasks,
      nights: nights.length,
      sleepAvg: nights.length ? Math.round(nights.reduce((a, n) => a + n.minutes, 0) / nights.length) : 0,
    }
  }, [days, period.start, period.end, upTo, state.tasks, state.sleep])

  const maxDay = Math.max(1, ...Object.values(days).map((d) => d.total))
  const top = topCategory(data.catTime)
  const topCat = cats[top]
  const streak = loggedStreak(days, today)
  const catRows = [...state.categories.map((c) => ({ id: c.id, name: c.name, color: c.color, seconds: data.catTime[c.id] ?? 0 })), ...(data.catTime.none ? [{ id: 'none', name: 'No category', color: 'var(--muted)', seconds: data.catTime.none }] : [])]

  const columns = useMemo(() => weekColumns(period.start, period.end), [period.start, period.end])
  const yearStart = addDays(mondayOf(today), -51 * 7)
  const yearColumns = useMemo(() => weekColumns(yearStart, addDays(mondayOf(today), 6)), [yearStart, today])

  const selectedData = days[selected]
  const selectedTop = cats[topCategory(selectedData?.cats)]

  const change = (range2) => {
    setRange(range2)
    setOffset(0)
    setPicked(null)
  }
  const step = (n) => {
    setOffset((o) => Math.min(0, o + n))
    setPicked(null)
  }

  // Clicking a square in the 12-month grid opens that day's month.
  const jumpTo = (date) => {
    const a = parseDate(today)
    const b = parseDate(date)
    setRange('month')
    setOffset((b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth())
    setPicked(date)
  }

  const summary = data.total ? (
    <>
      {isCurrent ? `${period.name} so far` : period.name}: <b>{formatDuration(data.total)}</b> logged.
      {topCat && (
        <>
          {' '}
          Most of it went to <b style={{ color: topCat.color }}>{topCat.name}</b>.
        </>
      )}
    </>
  ) : (
    <>Nothing logged {isCurrent ? 'yet' : 'in this period'}. Add time from the Today page.</>
  )

  return (
    <div className="adm-page is-dash adm-insights">
      <header className="adm-pagehead">
        <div>
          <h1>Insights</h1>
          <p className="adm-sub">Where your time actually went</p>
        </div>
      </header>

      <div className="adm-range">
        <Segmented label="Time range" value={range} onChange={change} options={[{ id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }, { id: 'year', label: 'Year' }]} />
        <div className="adm-stepper">
          <button type="button" className="adm-icon-btn" aria-label={`Previous ${range}`} onClick={() => step(-1)}>
            <TbChevronLeft aria-hidden="true" />
          </button>
          <span aria-live="polite">{period.label}</span>
          <button type="button" className="adm-icon-btn" aria-label={`Next ${range}`} disabled={isCurrent} onClick={() => step(1)}>
            <TbChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="adm-dcard adm-summary">{summary}</p>

      <section className="adm-dcard adm-period" aria-label="Time logged">
        <div className="adm-period-main">
          <p className="adm-eyebrow">Logged {range === 'month' ? monthName(period.start, { month: 'long' }) : period.label}</p>
          <p className="adm-big">{data.total ? formatDuration(data.total) : '0M'}</p>
          <span className="adm-stack" role="img" aria-label="Time by category">
            {catRows.map((c) => (c.seconds ? <i key={c.id} style={{ flex: c.seconds, background: c.color }} /> : null))}
          </span>
          <p className="adm-legend">
            {catRows.map((c) => (
              <span key={c.id}>
                <CategoryDot color={c.color} /> {c.name} <b>{formatDuration(c.seconds)}</b>
              </span>
            ))}
          </p>
        </div>
        <div className="adm-squares">
          <p className="adm-eyebrow">{range === 'year' ? `${period.label} squares` : `${monthName(period.start, { month: 'long' })} squares`}</p>
          {range !== 'year' && (
            <div className="adm-heat-days" aria-hidden="true">
              {DAY_LABELS.map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
          )}
          <Heatmap columns={columns} days={days} max={maxDay} today={today} selected={selected} onSelect={setPicked} cats={cats} label="Days in this period" monthLabels={range === 'year'} />
          <p className="adm-heat-caption">
            {longDate(selected)}
            {selectedData?.total ? (
              <>
                : {formatDuration(selectedData.total)}
                {selectedTop && <>, mostly {selectedTop.name}</>}
              </>
            ) : (
              ': nothing logged'
            )}
          </p>
        </div>
      </section>

      <div className="adm-statrow">
        <div className="adm-dcard">
          <p className="adm-eyebrow">Active days</p>
          <p className="adm-statnum">{data.active}</p>
          <small>of {data.elapsed} days</small>
        </div>
        <div className="adm-dcard">
          <p className="adm-eyebrow">Best day</p>
          <p className="adm-statnum">{data.best ? formatDuration(data.best.total) : '—'}</p>
          <small>{data.best ? monthName(data.best.date, { weekday: 'short', day: 'numeric', month: 'short' }) : 'No time logged'}</small>
        </div>
        <div className="adm-dcard">
          <p className="adm-eyebrow">Day streak</p>
          <p className="adm-statnum">{streak}</p>
          <small>days logged in a row</small>
        </div>
        <div className="adm-dcard">
          <p className="adm-eyebrow">Tasks done</p>
          <p className="adm-statnum">{data.doneTasks}</p>
          <small>{data.doneTasks === 1 ? 'task' : 'tasks'}</small>
        </div>
        <div className="adm-dcard">
          <p className="adm-eyebrow">Average sleep</p>
          <p className="adm-statnum">{data.sleepAvg ? hm(data.sleepAvg) : '—'}</p>
          <small>{data.nights ? `${data.nights} ${data.nights === 1 ? 'night' : 'nights'}` : 'No nights logged'}</small>
        </div>
      </div>

      <section className="adm-dcard adm-year" aria-label="The last 12 months">
        <header className="adm-dhead">
          <h2>The last 12 months</h2>
          <span>Each square is a day, coloured by where most time went</span>
        </header>
        <Heatmap columns={yearColumns} days={days} max={maxDay} today={today} selected={null} onSelect={jumpTo} cats={cats} label="Last 12 months" monthLabels />
      </section>
    </div>
  )
}
