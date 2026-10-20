import { useMemo } from 'react'
import { TbCheck, TbClockHour4, TbFlame, TbPencil, TbPlus, TbRepeat, TbTrash } from 'react-icons/tb'
import { useAdmin } from './ctx'
import {
  DAY_LABELS,
  DAY_NAMES,
  addDays,
  entryCategory,
  formatDuration,
  localDay,
  longDate,
  routineStreak,
  weekDates,
  weekdayIndex,
} from './store'
import { CategoryDot, EmptyState } from './ui'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

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

export function RoutinesPage() {
  const { state, today, newRoutine, editRoutine, dispatch } = useAdmin()
  const dates = weekDates(today)
  const scheduledToday = state.routines.filter((r) => r.days.includes(weekdayIndex(today)))
  const doneToday = scheduledToday.filter((r) => r.done[today]).length

  return (
    <div className="adm-page">
      <PageHead title="Routines" sub={`${plural(state.routines.length, 'routine')} · ${doneToday} of ${scheduledToday.length} done today`}>
        <button type="button" className="adm-btn is-light" onClick={newRoutine}>
          <TbPlus aria-hidden="true" /> New routine
        </button>
      </PageHead>

      {state.routines.length === 0 ? (
        <EmptyState icon={TbRepeat} title="No routines yet" action={<button type="button" className="adm-btn is-light" onClick={newRoutine}><TbPlus aria-hidden="true" /> Create a routine</button>}>
          Routines are things you repeat on set days, like replying to enquiries or reviewing the week. Tick them off as you go.
        </EmptyState>
      ) : (
        <ul className="adm-routines">
          {state.routines.map((r) => {
            const cat = state.categories.find((c) => c.id === r.categoryId)
            const streak = routineStreak(r, today)
            return (
              <li key={r.id} className="adm-routine">
                <div className="adm-routine-main">
                  <h3>{r.name}</h3>
                  <span className="adm-cat">
                    <CategoryDot color={cat?.color} /> {cat?.name}
                  </span>
                </div>
                <div className="adm-weekdots" role="group" aria-label={`${r.name} this week`}>
                  {dates.map((date, i) => {
                    const scheduled = r.days.includes(i)
                    const done = Boolean(r.done[date])
                    return (
                      <button
                        key={date}
                        type="button"
                        disabled={!scheduled || date > today}
                        className={`${done ? 'is-done' : ''}${scheduled ? ' is-scheduled' : ''}${date === today ? ' is-today' : ''}`}
                        aria-pressed={done}
                        aria-label={`${DAY_NAMES[i]}${scheduled ? (done ? ', done' : ', not done') : ', not scheduled'}`}
                        onClick={() => dispatch({ type: 'TOGGLE_ROUTINE_DAY', id: r.id, date })}
                      >
                        {DAY_LABELS[i]}
                      </button>
                    )
                  })}
                </div>
                <span className="adm-streak" title="Scheduled days in a row">
                  <TbFlame aria-hidden="true" /> {streak} <small>{streak === 1 ? 'day' : 'days'}</small>
                </span>
                <button type="button" className="adm-icon-btn" aria-label={`Edit ${r.name}`} onClick={() => editRoutine(r.id)}>
                  <TbPencil aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
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
