import { useMemo, useState } from 'react'
import { TbArrowDown, TbArrowUp, TbPlayerPlayFilled, TbPlayerStopFilled } from 'react-icons/tb'
import { useAdmin } from './ctx'
import { STATUSES, daysBetween, formatDuration, priorityRank, taskSeconds } from './store'
import { DueChip, LabelChips, PriorityChip, SubtaskMeter } from './ui'

const STATUS_ORDER = Object.fromEntries(STATUSES.map((s, i) => [s.id, i]))

const COLUMNS = [
  { key: 'title', label: 'Task' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'due', label: 'Due' },
  { key: 'time', label: 'Time' },
]

export default function ListView({ tasks, onOpen, onStatus }) {
  const { state, today, now, toggleTimer } = useAdmin()
  const [sort, setSort] = useState({ key: 'due', dir: 1 })

  const rows = useMemo(() => {
    const spent = (t) => state.entries.reduce((n, e) => (e.taskId === t.id ? n + e.seconds : n), 0)
    const compare = {
      title: (a, b) => a.title.localeCompare(b.title),
      status: (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
      priority: (a, b) => priorityRank(a.priority) - priorityRank(b.priority),
      // Tasks without a due date always sort to the bottom.
      due: (a, b) => (a.dueDate && b.dueDate ? daysBetween(b.dueDate, a.dueDate) : a.dueDate ? -1 : b.dueDate ? 1 : 0),
      time: (a, b) => spent(b) - spent(a),
    }[sort.key]
    return [...tasks].sort((a, b) => sort.dir * compare(a, b) || priorityRank(a.priority) - priorityRank(b.priority) || a.title.localeCompare(b.title))
  }, [tasks, sort, state.entries])

  const toggle = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: 1 }))

  return (
    <div className="adm-tablewrap">
      <table className="adm-table">
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                <button type="button" onClick={() => toggle(c.key)}>
                  {c.label}
                  {sort.key === c.key && (sort.dir === 1 ? <TbArrowUp aria-hidden="true" /> : <TbArrowDown aria-hidden="true" />)}
                </button>
              </th>
            ))}
            <th scope="col">
              <span className="adm-visually-hidden">Timer</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const running = state.timer?.taskId === t.id
            return (
              <tr key={t.id} className={t.status === 'done' ? 'is-done' : ''}>
                <td className="adm-cell-title">
                  <button type="button" onClick={() => onOpen(t.id)}>
                    <strong>{t.title}</strong>
                  </button>
                  <span className="adm-cell-sub">
                    <LabelChips labels={t.labels} max={4} />
                    <SubtaskMeter task={t} />
                  </span>
                </td>
                <td>
                  <select className="adm-quick" style={{ '--c': STATUSES.find((s) => s.id === t.status).color }} value={t.status} aria-label={`Status of ${t.title}`} onChange={(e) => onStatus(t.id, e.target.value)}>
                    {STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <PriorityChip priority={t.priority} />
                </td>
                <td>{t.dueDate ? <DueChip item={t} today={today} /> : <span className="adm-muted">None</span>}</td>
                <td className="adm-mono">{formatDuration(taskSeconds(state, t, now))}</td>
                <td>
                  <button
                    type="button"
                    className={`adm-play${running ? ' is-running' : ''}`}
                    aria-label={running ? `Stop the timer for ${t.title}` : `Start the timer for ${t.title}`}
                    onClick={() => toggleTimer(t.id)}
                  >
                    {running ? <TbPlayerStopFilled aria-hidden="true" /> : <TbPlayerPlayFilled aria-hidden="true" />}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
