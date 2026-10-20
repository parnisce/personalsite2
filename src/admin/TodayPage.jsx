import { useId, useMemo, useState } from 'react'
import { TbCheck, TbFlame, TbMoon, TbPlayerPlayFilled, TbPlayerStopFilled, TbPlus, TbTrash } from 'react-icons/tb'
import logo from '../assets/logo.webp'
import { useAdmin } from './ctx'
import Modal from './Modal'
import { addDays, dayTotals, entryCategory, formatDuration, loggedStreak, localDay, longDate, priorityRank, routineDueToday, routineTarget, sleepMinutes, topCategory, uid, weekDates } from './store'
import { CategoryDot, DueChip, StatusTag } from './ui'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const QUICK = [
  { label: '15M', minutes: 15 },
  { label: '30M', minutes: 30 },
  { label: '1H', minutes: 60 },
  { label: '2H', minutes: 120 },
]
const hm = (minutes) => `${Math.floor(minutes / 60)}H ${String(minutes % 60).padStart(2, '0')}M`

function LogTimeModal({ category, onSave, onClose }) {
  const { state } = useAdmin()
  const base = useId()
  const [categoryId, setCategoryId] = useState(category ?? state.categories[0].id)
  const [minutes, setMinutes] = useState('45')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const m = Number(minutes)
    if (!(m >= 1 && m <= 1440)) {
      setError('Enter between 1 and 1440 minutes.')
      return
    }
    onSave({ categoryId, seconds: Math.round(m) * 60, title: note })
  }

  return (
    <Modal
      title="Add time"
      size="sm"
      onClose={onClose}
      onSubmit={submit}
      footer={({ requestClose }) => (
        <>
          <span className="adm-spacer" />
          <button type="button" className="adm-btn is-ghost" onClick={requestClose}>
            Cancel
          </button>
          <button type="submit" className="adm-btn is-primary">
            Add time
          </button>
        </>
      )}
    >
      <div className="adm-field">
        <label htmlFor={`${base}-cat`}>Category</label>
        <select id={`${base}-cat`} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {state.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="adm-field">
        <label htmlFor={`${base}-min`}>Minutes</label>
        <input
          id={`${base}-min`}
          data-autofocus
          type="number"
          min="1"
          max="1440"
          inputMode="numeric"
          value={minutes}
          aria-invalid={error ? 'true' : undefined}
          onChange={(e) => {
            setMinutes(e.target.value)
            setError('')
          }}
        />
        {error && (
          <p className="adm-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="adm-field">
        <label htmlFor={`${base}-note`}>What was it? (optional)</label>
        <input id={`${base}-note`} value={note} maxLength={120} placeholder="e.g. Gym" onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  )
}

function SleepModal({ date, existing, onSave, onDelete, onClose }) {
  const base = useId()
  const [bed, setBed] = useState(existing?.bed ?? '23:00')
  const [wake, setWake] = useState(existing?.wake ?? '07:00')
  const valid = /^\d\d:\d\d$/.test(bed) && /^\d\d:\d\d$/.test(wake)
  return (
    <Modal
      title="Log your sleep"
      size="sm"
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSave({ date, bed, wake })
      }}
      footer={({ requestClose }) => (
        <>
          {existing && (
            <button type="button" className="adm-btn is-danger" onClick={onDelete}>
              <TbTrash aria-hidden="true" /> Remove
            </button>
          )}
          <span className="adm-spacer" />
          <button type="button" className="adm-btn is-ghost" onClick={requestClose}>
            Cancel
          </button>
          <button type="submit" className="adm-btn is-primary" disabled={!valid}>
            Save
          </button>
        </>
      )}
    >
      <p className="adm-hint">Counts on the day you woke up ({longDate(date)}).</p>
      <div className="adm-field">
        <label htmlFor={`${base}-bed`}>Went to bed</label>
        <input id={`${base}-bed`} data-autofocus type="time" value={bed} onChange={(e) => setBed(e.target.value)} />
      </div>
      <div className="adm-field">
        <label htmlFor={`${base}-wake`}>Woke up</label>
        <input id={`${base}-wake`} type="time" value={wake} onChange={(e) => setWake(e.target.value)} />
      </div>
      {valid && <p className="adm-hint">That is {hm(sleepMinutes(bed, wake))} of sleep.</p>}
    </Modal>
  )
}

export default function TodayPage() {
  const { state, dispatch, today, now, newTask, openTask, toggleTimer, toast } = useAdmin()
  const [catId, setCatId] = useState(null)
  const [modal, setModal] = useState(null) // 'time' | 'sleep'

  const days = useMemo(() => dayTotals(state, now), [state, now])
  const todayData = days[today] ?? { total: 0, cats: {} }
  const cats = Object.fromEntries(state.categories.map((c) => [c.id, c]))
  const selected = catId && cats[catId] ? catId : state.categories[0].id
  const topCat = cats[topCategory(todayData.cats)]
  const streak = loggedStreak(days, today)
  const seconds = todayData.total

  const open = state.tasks.filter((t) => t.status !== 'done')
  const sortTasks = (a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.title.localeCompare(b.title)
  const focusTasks = [
    ...open.filter((t) => t.dueDate && t.dueDate <= today).sort(sortTasks),
    ...open.filter((t) => t.status === 'doing' && !(t.dueDate && t.dueDate <= today)).sort(sortTasks),
  ]
  const week = weekDates(today)
  const routines = state.routines.filter((r) => routineDueToday(r, today))
  const routinesWaiting = routines.filter((r) => !r.done[today]).length
  const todayEntries = state.entries.filter((e) => localDay(e.start) === today)

  const nights = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map((date) => ({ date, night: state.sleep.find((n) => n.date === date) }))
  const slept = nights.filter((n) => n.night)
  const avg = slept.length ? Math.round(slept.reduce((a, n) => a + n.night.minutes, 0) / slept.length) : 0
  const last = [...slept].reverse()[0]?.night
  const maxSleep = Math.max(600, ...slept.map((n) => n.night.minutes))

  const logTime = ({ categoryId, seconds: secs, title }) => {
    const id = uid()
    dispatch({ type: 'ADD_TIME', id, categoryId, seconds: secs, title })
    toast(`Logged ${formatDuration(secs)} to ${cats[categoryId]?.name}`, { label: 'Undo', run: () => dispatch({ type: 'DELETE_ENTRY', id }) })
    setModal(null)
  }

  return (
    <div className="adm-page is-dash">
      <section className="adm-greet" aria-label="Summary">
        <img src={logo} alt="" width="46" height="46" />
        <div>
          <p className="adm-eyebrow">{longDate(today)}</p>
          <p className="adm-greet-text">
            Nice, Cyryl.{' '}
            {seconds ? (
              <>
                <b>{formatDuration(seconds)}</b> logged
                {topCat && (
                  <>
                    , mostly <b style={{ color: topCat.color }}>{topCat.name}</b>
                  </>
                )}
                .
              </>
            ) : (
              'Nothing logged yet today.'
            )}{' '}
            {plural(routinesWaiting, 'routine')} {routinesWaiting === 1 ? 'is' : 'are'} waiting for you and {plural(focusTasks.length, 'task')} {focusTasks.length === 1 ? 'is' : 'are'} on today’s list.
          </p>
        </div>
      </section>

      <div className="adm-dash-top">
        <section className="adm-dcard adm-logged" aria-label="Logged today">
          <div className="adm-logged-main">
            <p className="adm-eyebrow">Logged today</p>
            {streak > 0 && (
              <span className="adm-streak">
                <TbFlame aria-hidden="true" /> {streak}-day streak
              </span>
            )}
            <p className="adm-big">{seconds ? formatDuration(seconds) : '0M'}</p>
            <span className="adm-stack" role="img" aria-label="Time by category today">
              {state.categories.map((c) => (todayData.cats[c.id] ? <i key={c.id} style={{ flex: todayData.cats[c.id], background: c.color }} /> : null))}
            </span>
            <p className="adm-legend">
              {state.categories
                .filter((c) => todayData.cats[c.id])
                .map((c) => (
                  <span key={c.id}>
                    <CategoryDot color={c.color} /> {c.name} <b>{formatDuration(todayData.cats[c.id])}</b>
                  </span>
                ))}
            </p>
          </div>
          {topCat && (
            <span className="adm-tile" style={{ '--c': topCat.color }}>
              <i />
              <small>{topCat.name}</small>
            </span>
          )}
          <div className="adm-logged-actions">
            <div className="adm-pills" role="group" aria-label="Category to log time to">
              {state.categories.map((c) => (
                <button key={c.id} type="button" className={selected === c.id ? 'is-active' : ''} aria-pressed={selected === c.id} onClick={() => setCatId(c.id)}>
                  <CategoryDot color={c.color} /> {c.name}
                </button>
              ))}
            </div>
            <div className="adm-pills is-quick" role="group" aria-label="Add time to the selected category">
              {QUICK.map((q) => (
                <button key={q.label} type="button" onClick={() => logTime({ categoryId: selected, seconds: q.minutes * 60 })}>
                  {q.label}
                </button>
              ))}
              <button type="button" onClick={() => setModal('time')}>
                Custom
              </button>
            </div>
          </div>
        </section>

        <section className="adm-dcard adm-sleep" aria-label="Sleep">
          <header>
            <span className="adm-sleep-icon">
              <TbMoon aria-hidden="true" />
            </span>
            <div>
              <h2>How did you sleep?</h2>
              <p>Counts on the day you wake up</p>
            </div>
            <button type="button" className="adm-btn is-ghost" onClick={() => setModal('sleep')}>
              {state.sleep.some((n) => n.date === today) ? 'Edit' : 'Log'}
            </button>
          </header>
          <p className="adm-eyebrow adm-sleep-meta">
            <span>Last 14 nights</span>
            {avg > 0 && <span>avg {hm(avg)}</span>}
          </p>
          <div className="adm-nights" role="img" aria-label={slept.length ? `Sleep over the last 14 nights, average ${hm(avg)}` : 'No sleep logged yet'}>
            {nights.map(({ date, night }) => (
              <span key={date} title={night ? `${longDate(date)}: ${hm(night.minutes)}` : `${longDate(date)}: not logged`}>
                {night && <i style={{ height: `${(night.minutes / maxSleep) * 100}%` }} />}
              </span>
            ))}
          </div>
          <p className="adm-eyebrow adm-sleep-meta">
            <span>{last ? 'Last night' : 'Nothing logged yet'}</span>
            {last && (
              <span>
                {hm(last.minutes)} · {last.bed} to {last.wake}
              </span>
            )}
          </p>
        </section>
      </div>

      <div className="adm-dash-bottom">
        <section className="adm-dcard" aria-label="Tasks">
          <header className="adm-dhead">
            <h2>
              Tasks <span>{focusTasks.length}</span>
            </h2>
            <a href="#/projects">See all</a>
          </header>
          {focusTasks.length ? (
            <ul className="adm-dlist">
              {focusTasks.slice(0, 5).map((t) => {
                const project = state.projects.find((p) => p.id === t.projectId)
                const running = state.timer?.taskId === t.id
                return (
                  <li key={t.id}>
                    <button type="button" className="adm-tick" aria-label={`Mark "${t.title}" as done`} onClick={() => dispatch({ type: 'UPDATE_TASK', id: t.id, patch: { status: 'done' } })} />
                    <button type="button" className="adm-dtitle" onClick={() => openTask(t.id)}>
                      <span>{t.title}</span>
                      <small>
                        <StatusTag status={t.status} />
                        {project && (
                          <>
                            <CategoryDot color={cats[project.categoryId]?.color} /> {project.name}
                          </>
                        )}
                        <DueChip item={t} today={today} />
                      </small>
                    </button>
                    <button type="button" className={`adm-play${running ? ' is-running' : ''}`} aria-label={running ? `Stop the timer for ${t.title}` : `Start the timer for ${t.title}`} onClick={() => toggleTimer(t.id)}>
                      {running ? <TbPlayerStopFilled aria-hidden="true" /> : <TbPlayerPlayFilled aria-hidden="true" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="adm-dempty">Nothing due or in progress.</p>
          )}
          <button type="button" className="adm-dadd" onClick={() => newTask({ dueDate: today })}>
            <TbPlus aria-hidden="true" /> Add task
          </button>
        </section>

        <section className="adm-dcard" aria-label="Routines">
          <header className="adm-dhead">
            <h2>Routines</h2>
            <span>This week</span>
          </header>
          {routines.length ? (
            <ul className="adm-dlist">
              {routines.map((r) => {
                const doneWeek = week.filter((d) => r.done[d]).length
                const target = routineTarget(r)
                const done = Boolean(r.done[today])
                return (
                  <li key={r.id} className={done ? 'is-done' : ''}>
                    <span className="adm-miniring" style={{ '--p': Math.min(1, doneWeek / target) }} aria-hidden="true" />
                    <span className="adm-dtitle is-static">
                      <span>{r.name}</span>
                      <small>{r.mode === 'times' ? `${target}x a week` : `${target} days a week`}</small>
                    </span>
                    <span className="adm-mono">
                      {doneWeek} / {target}
                    </span>
                    <button type="button" className={`adm-donebtn${done ? ' is-done' : ''}`} aria-pressed={done} onClick={() => dispatch({ type: 'TOGGLE_ROUTINE_DAY', id: r.id, date: today })}>
                      {done && <TbCheck aria-hidden="true" />} Done
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="adm-dempty">No routines scheduled for today.</p>
          )}
          <a className="adm-dadd" href="#/routines">
            Manage routines
          </a>
        </section>

        <section className="adm-dcard" aria-label="Logged">
          <header className="adm-dhead">
            <h2>Logged</h2>
            <a href="#/log">Open log</a>
          </header>
          {todayEntries.length ? (
            <ul className="adm-dlist">
              {todayEntries.slice(0, 5).map((e) => {
                const cat = cats[entryCategory(state, e)]
                return (
                  <li key={e.id} className="adm-dlog" style={{ '--c': cat?.color ?? 'var(--muted)' }}>
                    <span className="adm-dtitle is-static">
                      <span>{e.title}</span>
                      <small>
                        {new Date(e.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {cat?.name ?? 'No category'}
                      </small>
                    </span>
                    <span className="adm-mono">{formatDuration(e.seconds)}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="adm-dempty">No time logged today.</p>
          )}
          <button type="button" className="adm-dadd" onClick={() => setModal('time')}>
            <TbPlus aria-hidden="true" /> Add time
          </button>
        </section>
      </div>

      {modal === 'time' && <LogTimeModal category={selected} onSave={logTime} onClose={() => setModal(null)} />}
      {modal === 'sleep' && (
        <SleepModal
          date={today}
          existing={state.sleep.find((n) => n.date === today)}
          onClose={() => setModal(null)}
          onSave={(n) => {
            dispatch({ type: 'ADD_SLEEP', ...n })
            toast('Sleep saved')
            setModal(null)
          }}
          onDelete={() => {
            dispatch({ type: 'DELETE_SLEEP', date: today })
            setModal(null)
          }}
        />
      )}
    </div>
  )
}
