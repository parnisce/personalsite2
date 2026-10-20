import { useMemo, useState } from 'react'
import { TbArrowLeft, TbCheck, TbFolder, TbPencil, TbPlus } from 'react-icons/tb'
import { useAdmin } from './ctx'
import Modal from './Modal'
import Board from './Board'
import ListView from './ListView'
import { STATUSES, dueChipText, dueDistance, dueState, formatDuration, longDate, projectStats, taskSeconds } from './store'
import { Bar, CategoryDot, DueChip, EmptyState, Ring, Segmented } from './ui'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// A project's due chip turns "Done" once every task is finished, so it never shows as overdue.
const projectDueItem = (p, stats) => ({ dueDate: p.dueDate, status: stats.total && stats.done === stats.total ? 'done' : 'open' })

// ---------------------------------------------------------------- all projects

export function ProjectsPage() {
  const { state, today, newTask, newProject, dispatch } = useAdmin()
  const [filter, setFilter] = useState('all')
  const categories = Object.fromEntries(state.categories.map((c) => [c.id, c]))
  const projects = state.projects.filter((p) => filter === 'all' || p.categoryId === filter)
  const openTasks = state.tasks.filter((t) => t.status !== 'done').length
  const quick = state.tasks.filter((t) => !t.projectId && t.status !== 'done')

  return (
    <div className="adm-page">
      <header className="adm-pagehead">
        <div>
          <h1>Projects</h1>
          <p className="adm-sub">
            {plural(state.projects.length, 'project')} · {plural(openTasks, 'open task')}
          </p>
        </div>
        <div className="adm-actions">
          <button type="button" className="adm-btn is-ghost" onClick={() => newTask()}>
            <TbPlus aria-hidden="true" /> New task
          </button>
          <button type="button" className="adm-btn is-light" onClick={newProject}>
            <TbPlus aria-hidden="true" /> New project
          </button>
        </div>
      </header>

      <div className="adm-pills" role="group" aria-label="Filter by category">
        <button type="button" className={filter === 'all' ? 'is-active' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </button>
        {state.categories.map((c) => (
          <button key={c.id} type="button" className={filter === c.id ? 'is-active' : ''} aria-pressed={filter === c.id} onClick={() => setFilter(c.id)}>
            <CategoryDot color={c.color} /> {c.name}
          </button>
        ))}
      </div>

      <div className="adm-projects">
        <div className="adm-pgrid">
          {projects.map((p) => {
            const stats = projectStats(p, state, today)
            const cat = categories[p.categoryId]
            return (
              <a key={p.id} href={`#/projects/${p.id}`} className="adm-pcard">
                <div className="adm-pcard-top">
                  <span className="adm-cat">
                    <CategoryDot color={cat?.color} /> {cat?.name}
                  </span>
                  <DueChip item={projectDueItem(p, stats)} today={today} />
                </div>
                <h3>{p.name}</h3>
                <Bar value={stats.percent} color={cat?.color} />
                <div className="adm-pcard-foot">
                  <span className="adm-next">
                    {stats.next ? (
                      <>
                        Next: <b>{stats.next.title}</b>
                      </>
                    ) : stats.total ? (
                      'All tasks done'
                    ) : (
                      'No tasks yet'
                    )}
                  </span>
                  <span className="adm-mono">
                    {formatDuration(stats.seconds)} · {stats.done}/{stats.total}
                  </span>
                </div>
              </a>
            )
          })}
          <button type="button" className="adm-pcard is-new" onClick={newProject}>
            <TbPlus aria-hidden="true" />
            <span>New project</span>
          </button>
        </div>

        <aside className="adm-quick-panel" aria-label="Quick tasks">
          <h2>
            Quick tasks <span>{quick.length}</span>
          </h2>
          <p>Tasks without a project</p>
          {quick.length > 0 && (
            <ul>
              {quick.slice(0, 6).map((t) => (
                <li key={t.id}>
                  <button type="button" className="adm-tick" aria-label={`Mark "${t.title}" as done`} onClick={() => dispatch({ type: 'UPDATE_TASK', id: t.id, patch: { status: 'done' } })} />
                  <QuickOpen task={t} />
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="adm-add" onClick={() => newTask()}>
            <TbPlus aria-hidden="true" /> Add
          </button>
        </aside>
      </div>
    </div>
  )
}

function QuickOpen({ task }) {
  const { openTask, today } = useAdmin()
  const state = dueState(task, today)
  return (
    <button type="button" className="adm-quick-title" onClick={() => openTask(task.id)}>
      <span>{task.title}</span>
      {task.dueDate && <small className={`is-${state}`}>{state === 'overdue' ? 'Overdue' : 'Due'}</small>}
    </button>
  )
}

// ---------------------------------------------------------------- one project

function ProgressModal({ project, onClose }) {
  const { state, now } = useAdmin()
  const tasks = state.tasks.filter((t) => t.projectId === project.id)
  const total = tasks.length
  return (
    <Modal title={`${project.name}: progress`} size="md" onClose={onClose} onSubmit={(e) => e.preventDefault()} footer={() => <><span className="adm-spacer" /><button type="button" className="adm-btn is-primary" data-autofocus onClick={onClose}>Close</button></>}>
      <ul className="adm-bars">
        {STATUSES.map((s) => {
          const count = tasks.filter((t) => t.status === s.id).length
          return (
            <li key={s.id}>
              <span className="adm-bars-label">{s.label}</span>
              <Bar value={total ? (count / total) * 100 : 0} color={s.color} />
              <span className="adm-bars-count">{count}</span>
            </li>
          )
        })}
      </ul>
      <div className="adm-history">
        <h3>Time per task</h3>
        {tasks.length ? (
          <ul>
            {[...tasks]
              .sort((a, b) => taskSeconds(state, b, now) - taskSeconds(state, a, now))
              .map((t) => (
                <li key={t.id}>
                  <span>{t.title}</span>
                  <span className="adm-mono">
                    {formatDuration(taskSeconds(state, t, now))}
                    {t.estimate > 0 && ` / ${formatDuration(t.estimate * 60)}`}
                  </span>
                </li>
              ))}
          </ul>
        ) : (
          <p className="adm-hint">No tasks yet.</p>
        )}
      </div>
    </Modal>
  )
}

const VIEW_KEY = 'cb-admin-project-view'
const loadView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'board'
  } catch {
    return 'board'
  }
}

export function ProjectPage({ id }) {
  const { state, today, now, newTask, openTask, editProject, dispatch } = useAdmin()
  const [view, setView] = useState(loadView)
  const [showProgress, setShowProgress] = useState(false)
  const project = state.projects.find((p) => p.id === id)
  const stats = useMemo(() => (project ? projectStats(project, state, today) : null), [project, state, today])

  if (!project) {
    return (
      <div className="adm-page">
        <EmptyState
          icon={TbFolder}
          title="Project not found"
          action={
            <a className="adm-btn is-light" href="#/projects">
              Back to projects
            </a>
          }
        >
          It may have been deleted.
        </EmptyState>
      </div>
    )
  }

  const category = state.categories.find((c) => c.id === project.categoryId)
  const dueItem = projectDueItem(project, stats)
  const dueLate = project.dueDate && dueState(dueItem, today) === 'overdue'
  const running = state.timer && state.tasks.find((t) => t.id === state.timer.taskId)?.projectId === project.id
  const seconds = stats.seconds + (running && now ? Math.max(0, Math.floor((now - new Date(state.timer.startedAt).getTime()) / 1000)) : 0)
  const setViewMode = (next) => {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // The choice just is not remembered.
    }
  }

  return (
    <div className="adm-page">
      <a href="#/projects" className="adm-back">
        <TbArrowLeft aria-hidden="true" /> Projects
      </a>

      <section className="adm-phead" aria-label="Project summary">
        <div className="adm-phead-top">
          <Ring percent={stats.percent} />
          <div className="adm-phead-title">
            <span className="adm-cat">
              <CategoryDot color={category?.color} /> {category?.name}
            </span>
            <h1>{project.name}</h1>
            <p className="adm-phead-meta">
              {project.dueDate && <span className={dueLate ? 'is-late' : ''}>{dueChipText(dueItem, today)}</span>}
              <span>{formatDuration(seconds)} logged</span>
              <span>
                {stats.done} / {stats.total} tasks done
              </span>
            </p>
            {project.description && <p className="adm-phead-desc">{project.description}</p>}
          </div>
          <div className="adm-actions">
            <button type="button" className="adm-btn is-ghost" onClick={() => setShowProgress(true)}>
              Progress
            </button>
            <button type="button" className="adm-btn is-ghost" onClick={() => editProject(project.id)}>
              <TbPencil aria-hidden="true" /> Edit
            </button>
          </div>
        </div>

        <dl className="adm-pstats">
          <div>
            <dt>Tasks done</dt>
            <dd>
              {stats.done} / {stats.total}
            </dd>
            <Bar value={stats.percent} color="var(--accent)" />
          </div>
          <div>
            <dt>Time logged</dt>
            <dd>{formatDuration(seconds)}</dd>
            <small>{stats.estimate ? `of ${formatDuration(stats.estimate * 60)} estimated` : 'No estimates yet'}</small>
            <Bar value={stats.estimate ? (seconds / (stats.estimate * 60)) * 100 : 0} color="var(--accent)" />
          </div>
          <div>
            <dt>In progress</dt>
            <dd>{stats.doing}</dd>
            <small>
              {stats.blocked} blocked · {stats.open} open
            </small>
          </div>
          <div>
            <dt>Due</dt>
            {project.dueDate ? (
              <>
                <dd className={dueLate ? 'is-late' : ''}>{stats.total && stats.done === stats.total ? 'Finished' : dueDistance(project.dueDate, today)}</dd>
                <small>{longDate(project.dueDate)}</small>
              </>
            ) : (
              <>
                <dd className="adm-muted">None</dd>
                <small>No due date set</small>
              </>
            )}
          </div>
        </dl>
      </section>

      <section aria-label="Tasks">
        <div className="adm-secthead">
          <div>
            <h2>
              Tasks <span>{stats.total}</span>
            </h2>
            {view === 'board' && <p className="adm-sub">Drag a card to another column to change its status</p>}
          </div>
          <Segmented label="Task view" value={view} onChange={setViewMode} options={[{ id: 'list', label: 'List' }, { id: 'board', label: 'Board' }]} />
        </div>
        {view === 'board' ? (
          <Board tasks={stats.tasks} onMove={(taskId, status, beforeId) => dispatch({ type: 'MOVE_TASK', id: taskId, status, beforeId })} onOpen={openTask} onNew={(status) => newTask({ projectId: project.id, status })} />
        ) : stats.tasks.length ? (
          <ListView tasks={stats.tasks} onOpen={openTask} onStatus={(taskId, status) => dispatch({ type: 'UPDATE_TASK', id: taskId, patch: { status } })} />
        ) : (
          <EmptyState icon={TbCheck} title="No tasks yet" action={<button type="button" className="adm-btn is-light" onClick={() => newTask({ projectId: project.id })}><TbPlus aria-hidden="true" /> Add a task</button>}>
            Add the first task for this project.
          </EmptyState>
        )}
      </section>

      {showProgress && <ProgressModal project={project} onClose={() => setShowProgress(false)} />}
    </div>
  )
}
