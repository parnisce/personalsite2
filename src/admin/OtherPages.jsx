import { useMemo } from 'react'
import { TbCheck, TbClockHour4, TbPencil, TbPlus, TbTrash } from 'react-icons/tb'
import { useAdmin } from './ctx'
import {
  DAY_NAMES,
  addDays,
  entryCategory,
  formatDuration,
  localDay,
  longDate,
  parseDate,
  routineChecks,
  routineTarget,
  routineWeekStreak,
  weekDates,
  weekdayIndex,
} from './store'
import { CategoryDot, EmptyState, Ring } from './ui'


function PageHead({ title, sub, children }) {
  return (
    <header className="adm-pagehead">
      <div>
        <h1>{title}</h1>
        {sub && <p className="adm-sub">{sub}</p>}
      </div>
      {children && <div className="adm-actions">{children}</div>}
    </header>
  )
}

// ---------------------------------------------------------------- Routines

const WEEK_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const rangeLabel = (a, b) => {
  const fmt = (d, weekday) => parseDate(d).toLocaleDateString('en-GB', { weekday: weekday ? 'short' : undefined, day: 'numeric', month: 'short' })
  return `${fmt(a, true)} to ${fmt(b, true)}`
}

const frequencyText = (r) => {
  if (r.mode === 'times') return `${r.perWeek}x a week`
  if (r.days.length === 7) return 'Every day'
  if (r.days.join() === '0,1,2,3,4') return 'Weekdays'
  return r.days.map((d) => DAY_NAMES[d].slice(0, 3)).join(', ')
}

function MiniRing({ value }) {
  const r = 9
  const c = 2 * Math.PI * r
  return (
    <svg className="adm-rt-ring" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r={r} fill="none" strokeWidth="3" className="adm-ring-track" />
      <circle cx="12" cy="12" r={r} fill="none" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, value))} transform="rotate(-90 12 12)" className="adm-ring-value" />
    </svg>
  )
}

export function RoutinesPage() {
  const { state, today, newRoutine, editRoutine, dispatch, toast } = useAdmin()
  const dates = weekDates(today)
  const cats = Object.fromEntries(state.categories.map((c) => [c.id, c]))

  const stats = state.routines.map((r) => ({ r, checks: routineChecks(r, today), target: routineTarget(r) }))
  const totalChecks = stats.reduce((n, s) => n + s.checks, 0)
  const totalTarget = stats.reduce((n, s) => n + s.target, 0)
  const percent = totalTarget ? Math.min(100, Math.round((totalChecks / totalTarget) * 100)) : 0
  const onTarget = stats.filter((s) => s.target > 0 && s.checks >= s.target).length

  const remove = (r) => {
    if (!window.confirm(`Delete the routine “${r.name}”?`)) return
    dispatch({ type: 'DELETE_ROUTINE', id: r.id })
    toast('Routine deleted')
  }

  return (
    <div className="adm-page adm-routines-page">
      <PageHead title="Routines" sub={`Week of ${parseDate(dates[0]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · check in each time you do one`}>
        <button type="button" className="adm-btn is-light" onClick={newRoutine}>
          <TbPlus aria-hidden="true" /> New routine
        </button>
      </PageHead>

      <section className="adm-dcard adm-rt-summary" aria-label="This week">
        <div className="adm-rt-sum-main">
          <Ring percent={percent} size={72} stroke={6} />
          <div>
            <p className="adm-eyebrow">This week</p>
            <p className="adm-big">
              {totalChecks} / {totalTarget}
            </p>
            <small>check-ins · {rangeLabel(dates[0], dates[6])}</small>
          </div>
        </div>
        <div className="adm-rt-sum-met">
          <p className="adm-eyebrow">Met this week</p>
          <p className="adm-big">
            {onTarget} / {state.routines.length}
          </p>
          <small>routines on target</small>
        </div>
      </section>

      <div className="adm-rt-grid">
        {stats.map(({ r, checks, target }) => {
          const cat = cats[r.categoryId]
          const streak = routineWeekStreak(r, today)
          const todayDone = Boolean(r.done[today])
          const todayAllowed = r.mode === 'times' || r.days.includes(weekdayIndex(today))
          const meta = [frequencyText(r), r.reminder, r.minutes ? formatDuration(r.minutes * 60) : ''].filter(Boolean).join(' · ')
          return (
            <article key={r.id} className="adm-dcard adm-rt-card">
              <header>
                <span className="adm-cat">
                  <CategoryDot color={cat?.color} /> {cat?.name}
                </span>
                <span className="adm-rt-streak">{streak ? `${streak}-week streak` : 'No streak yet'}</span>
              </header>
              <div className="adm-rt-title">
                <div>
                  <h3>{r.name}</h3>
                  <p>{meta}</p>
                </div>
                <div className="adm-rt-tools">
                  <button type="button" className="adm-icon-btn" aria-label={`Edit ${r.name}`} onClick={() => editRoutine(r.id)}>
                    <TbPencil aria-hidden="true" />
                  </button>
                  <button type="button" className="adm-icon-btn" aria-label={`Delete ${r.name}`} onClick={() => remove(r)}>
                    <TbTrash aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="adm-rt-days" role="group" aria-label={`${r.name} this week`}>
                {dates.map((date, i) => {
                  const allowed = r.mode === 'times' || r.days.includes(i)
                  const done = Boolean(r.done[date])
                  return (
                    <div key={date} className={date === today ? 'is-today' : ''}>
                      <button
                        type="button"
                        disabled={(!allowed && !done) || date > today}
                        className={`${done ? 'is-done' : ''}${allowed ? ' is-scheduled' : ''}`}
                        aria-pressed={done}
                        aria-label={`${DAY_NAMES[i]}${done ? ', done' : allowed ? ', not done' : ', not scheduled'}`}
                        onClick={() => dispatch({ type: 'TOGGLE_ROUTINE_DAY', id: r.id, date })}
                      >
                        {done && <TbCheck aria-hidden="true" />}
                      </button>
                      <span>{WEEK_SHORT[i]}</span>
                    </div>
                  )
                })}
              </div>
              <footer>
                <span className="adm-rt-progress">
                  <MiniRing value={target ? checks / target : 0} />
                  <b>
                    {checks} / {target}
                  </b>{' '}
                  this week
                </span>
                <button type="button" className={`adm-donebtn${todayDone ? ' is-done' : ''}`} disabled={!todayAllowed && !todayDone} aria-pressed={todayDone} onClick={() => dispatch({ type: 'TOGGLE_ROUTINE_DAY', id: r.id, date: today })}>
                  {todayDone && <TbCheck aria-hidden="true" />} {todayDone ? 'Done today' : 'Mark done'}
                </button>
              </footer>
            </article>
          )
        })}
        <button type="button" className="adm-rt-new" onClick={newRoutine}>
          <TbPlus aria-hidden="true" />
          <span>New routine</span>
        </button>
      </div>

      {state.routines.length === 0 && <p className="adm-dempty">Routines are things you repeat, like the gym or reviewing the week. Check in each time you do one and the week fills up.</p>}
    </div>
  )
}

// ---------------------------------------------------------------- Insights

// ---------------------------------------------------------------- Log

const dayTitle = (date, today) => {
  if (date === today) return 'Today'
  if (date === addDays(today, -1)) return 'Yesterday'
  return longDate(date)
}

export function LogPage() {
  const { state, today, dispatch, toast } = useAdmin()

  const groups = useMemo(() => {
    const days = new Map()
    const day = (date) => {
      if (!days.has(date)) days.set(date, { date, entries: [], finished: [] })
      return days.get(date)
    }
    state.entries.forEach((e) => day(localDay(e.start)).entries.push(e))
    state.tasks.forEach((t) => t.completedAt && day(localDay(t.completedAt)).finished.push(t))
    return [...days.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60)
  }, [state.entries, state.tasks])

  const removeEntry = (entry) => {
    dispatch({ type: 'DELETE_ENTRY', id: entry.id })
    toast(`Removed ${formatDuration(entry.seconds)} from the log`)
  }

  return (
    <div className="adm-page">
      <PageHead title="Log" sub="Time you have tracked, and tasks you have finished" />
      {groups.length === 0 ? (
        <EmptyState icon={TbClockHour4} title="Nothing logged yet">
          Press the play button on a task to track time. Finished work and time entries appear here by day.
        </EmptyState>
      ) : (
        groups.map((g) => {
          const total = g.entries.reduce((n, e) => n + e.seconds, 0)
          return (
            <section key={g.date} className="adm-block">
              <h2>
                {dayTitle(g.date, today)} {total > 0 && <span className="adm-mono">{formatDuration(total)}</span>}
              </h2>
              <ul className="adm-list">
                {g.entries.map((e) => {
                  const project = state.projects.find((p) => p.id === e.projectId)
                  const cat = state.categories.find((c) => c.id === entryCategory(state, e))
                  return (
                    <li key={e.id} className="adm-logrow">
                      <time dateTime={e.start}>{new Date(e.start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time>
                      <span className="adm-row-title is-static">
                        <span>{e.title}</span>
                        {(project || cat) && (
                          <small>
                            <CategoryDot color={cat?.color} /> {project?.name ?? cat?.name}
                          </small>
                        )}
                      </span>
                      <span className="adm-mono">{formatDuration(e.seconds)}</span>
                      <button type="button" className="adm-icon-btn" aria-label={`Remove the ${formatDuration(e.seconds)} entry for ${e.title}`} onClick={() => removeEntry(e)}>
                        <TbTrash aria-hidden="true" />
                      </button>
                    </li>
                  )
                })}
                {g.finished.map((t) => (
                  <li key={t.id} className="adm-logrow is-finished">
                    <TbCheck aria-hidden="true" />
                    <span className="adm-row-title is-static">
                      <span>{t.title}</span>
                      <small>Finished</small>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}
