import { useMemo } from 'react'
import { TbCheck, TbClockHour4, TbFlame, TbPencil, TbPlayerPlayFilled, TbPlayerStopFilled, TbPlus, TbRepeat, TbSun, TbTrash } from 'react-icons/tb'
import { useAdmin } from './ctx'
import {
  DAY_LABELS,
  DAY_NAMES,
  addDays,
  categoryTimeThisWeek,
  formatDuration,
  localDay,
  longDate,
  parseDate,
  priorityRank,
  routineStreak,
  timeFor,
  weekDates,
  weekdayIndex,
} from './store'
import { Bar, CategoryDot, DueChip, EmptyState, PriorityChip } from './ui'

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

// A compact task line used on the Today page.
function TaskRow({ task }) {
  const { state, today, openTask, dispatch, toggleTimer } = useAdmin()
  const project = state.projects.find((p) => p.id === task.projectId)
  const running = state.timer?.taskId === task.id
  return (
    <li className="adm-row-task">
      <button type="button" className="adm-tick" aria-label={`Mark "${task.title}" as done`} onClick={() => dispatch({ type: 'UPDATE_TASK', id: task.id, patch: { status: 'done' } })} />
      <button type="button" className="adm-row-title" onClick={() => openTask(task.id)}>
        <span>{task.title}</span>
        {project && <small>{project.name}</small>}
      </button>
      <span className="adm-row-meta">
        <PriorityChip priority={task.priority} />
        <DueChip item={task} today={today} />
      </span>
      <button type="button" className={`adm-play${running ? ' is-running' : ''}`} aria-label={running ? `Stop the timer for ${task.title}` : `Start the timer for ${task.title}`} onClick={() => toggleTimer(task.id)}>
        {running ? <TbPlayerStopFilled aria-hidden="true" /> : <TbPlayerPlayFilled aria-hidden="true" />}
      </button>
    </li>
  )
}

// ---------------------------------------------------------------- Today

function TaskSection({ title, tasks, tone }) {
  if (!tasks.length) return null
  return (
    <section className="adm-block">
      <h2 className={tone}>
        {title} <span>{tasks.length}</span>
      </h2>
      <ul className="adm-list">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </ul>
    </section>
  )
}

export function TodayPage() {
  const { state, today, newTask, dispatch } = useAdmin()
  const open = state.tasks.filter((t) => t.status !== 'done')
  const sortTasks = (a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.title.localeCompare(b.title)
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today).sort(sortTasks)
  const dueToday = open.filter((t) => t.dueDate === today).sort(sortTasks)
  const shown = new Set([...overdue, ...dueToday].map((t) => t.id))
  const inProgress = open.filter((t) => t.status === 'doing' && !shown.has(t.id)).sort(sortTasks)
  const routines = state.routines.filter((r) => r.days.includes(weekdayIndex(today)))
  const focus = overdue.length + dueToday.length + inProgress.length

  return (
    <div className="adm-page">
      <PageHead title="Today" sub={`${longDate(today)} · ${plural(focus, 'task')} to focus on`}>
        <button type="button" className="adm-btn is-light" onClick={() => newTask({ dueDate: today })}>
          <TbPlus aria-hidden="true" /> New task
        </button>
      </PageHead>

      {focus === 0 && routines.length === 0 && (
        <EmptyState icon={TbSun} title="Nothing on for today">
          No tasks are overdue, due today or in progress. Enjoy the quiet, or add something new.
        </EmptyState>
      )}

      <TaskSection title="Overdue" tasks={overdue} tone="is-late" />
      <TaskSection title="Due today" tasks={dueToday} />
      <TaskSection title="In progress" tasks={inProgress} />

      {routines.length > 0 && (
        <section className="adm-block">
          <h2>
            Routines <span>{routines.filter((r) => r.done[today]).length}/{routines.length}</span>
          </h2>
          <ul className="adm-list">
            {routines.map((r) => {
              const cat = state.categories.find((c) => c.id === r.categoryId)
              const done = Boolean(r.done[today])
              return (
                <li key={r.id} className={`adm-row-task${done ? ' is-done' : ''}`}>
                  <button type="button" className={`adm-tick${done ? ' is-checked' : ''}`} aria-pressed={done} aria-label={`${r.name}, ${done ? 'done today' : 'not done yet'}`} onClick={() => dispatch({ type: 'TOGGLE_ROUTINE_DAY', id: r.id, date: today })}>
                    {done && <TbCheck aria-hidden="true" />}
                  </button>
                  <span className="adm-row-title is-static">
                    <span>{r.name}</span>
                    <small>
                      <CategoryDot color={cat?.color} /> {cat?.name}
                    </small>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
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

export function InsightsPage() {
  const { state, today, now } = useAdmin()
  const data = useMemo(() => {
    const week = weekDates(today)
    const weekSet = new Set(week)
    const open = state.tasks.filter((t) => t.status !== 'done')
    const doneThisWeek = state.tasks.filter((t) => t.completedAt && weekSet.has(localDay(t.completedAt))).length
    const catTime = categoryTimeThisWeek(state, today)
    const last14 = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map((date) => ({
      date,
      done: state.tasks.filter((t) => t.completedAt && localDay(t.completedAt) === date).length,
      seconds: timeFor(state.entries, (e) => localDay(e.start) === date),
    }))
    return {
      weekSeconds: Object.values(catTime).reduce((a, b) => a + b, 0),
      catTime,
      doneThisWeek,
      open: open.length,
      rate: state.tasks.length ? Math.round(((state.tasks.length - open.length) / state.tasks.length) * 100) : 0,
      last14,
      maxDone: Math.max(1, ...last14.map((d) => d.done)),
      activeDays: new Set([...state.entries.map((e) => localDay(e.start)), ...state.tasks.filter((t) => t.completedAt).map((t) => localDay(t.completedAt))]).size,
    }
  }, [state, today])

  const live = state.timer && now ? Math.max(0, Math.floor((now - new Date(state.timer.startedAt).getTime()) / 1000)) : 0
  const catRows = [...state.categories.map((c) => ({ id: c.id, name: c.name, color: c.color, seconds: data.catTime[c.id] ?? 0 })), ...(data.catTime.none ? [{ id: 'none', name: 'No project', color: '#8f8c86', seconds: data.catTime.none }] : [])]
  const maxCat = Math.max(1, ...catRows.map((c) => c.seconds))

  if (!state.tasks.length && !state.entries.length) {
    return (
      <div className="adm-page">
        <PageHead title="Insights" sub="How your time and tasks are going" />
        <EmptyState icon={TbClockHour4} title="Nothing to show yet">
          Create tasks and track time with the play button, then your numbers show up here.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="adm-page">
      <PageHead title="Insights" sub="How your time and tasks are going" />
      <div className="adm-stats">
        <div className="adm-stat">
          <span>Time this week</span>
          <strong>{formatDuration(data.weekSeconds + live)}</strong>
        </div>
        <div className="adm-stat">
          <span>Tasks done this week</span>
          <strong>{data.doneThisWeek}</strong>
        </div>
        <div className="adm-stat">
          <span>Open tasks</span>
          <strong>{data.open}</strong>
        </div>
        <div className="adm-stat">
          <span>Completion rate</span>
          <strong>{data.rate}%</strong>
        </div>
      </div>

      <div className="adm-twocol">
        <section className="adm-card-panel">
          <h2>Time by category, this week</h2>
          <ul className="adm-bars">
            {catRows.map((c) => (
              <li key={c.id}>
                <span className="adm-bars-label">
                  <CategoryDot color={c.color} /> {c.name}
                </span>
                <Bar value={(c.seconds / maxCat) * 100} color={c.color} />
                <span className="adm-mono">{formatDuration(c.seconds)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="adm-card-panel">
          <h2>Tasks finished, last 14 days</h2>
          <div className="adm-chart" role="img" aria-label={`Tasks finished per day over the last 14 days: ${data.last14.map((d) => d.done).join(', ')}`}>
            {data.last14.map((d) => (
              <span key={d.date} title={`${parseDate(d.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}: ${d.done} done`} className={d.date === today ? 'is-today' : ''}>
                <i style={{ height: `${(d.done / data.maxDone) * 100}%` }} />
              </span>
            ))}
          </div>
          <p className="adm-hint">You were active on {data.activeDays} different {data.activeDays === 1 ? 'day' : 'days'} in total.</p>
        </section>
      </div>

      <section className="adm-card-panel">
        <h2>Project progress</h2>
        {state.projects.length ? (
          <ul className="adm-bars">
            {state.projects.map((p) => {
              const tasks = state.tasks.filter((t) => t.projectId === p.id)
              const done = tasks.filter((t) => t.status === 'done').length
              const cat = state.categories.find((c) => c.id === p.categoryId)
              return (
                <li key={p.id}>
                  <a className="adm-bars-label" href={`#/projects/${p.id}`}>
                    <CategoryDot color={cat?.color} /> {p.name}
                  </a>
                  <Bar value={tasks.length ? (done / tasks.length) * 100 : 0} color={cat?.color} />
                  <span className="adm-mono">
                    {done}/{tasks.length}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="adm-hint">No projects yet.</p>
        )}
      </section>
    </div>
  )
}

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
                  const cat = state.categories.find((c) => c.id === project?.categoryId)
                  return (
                    <li key={e.id} className="adm-logrow">
                      <time dateTime={e.start}>{new Date(e.start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time>
                      <span className="adm-row-title is-static">
                        <span>{e.title}</span>
                        {project && (
                          <small>
                            <CategoryDot color={cat?.color} /> {project.name}
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
