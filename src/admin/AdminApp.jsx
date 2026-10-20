import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AdminContext } from './ctx'
import { CategoriesModal, ProjectModal, RoutineModal } from './Editors'
import { useCloudSync } from './cloud'
import ContentPage from './ContentPage'
import EnquiriesPage from './EnquiriesPage'
import { useEnquiries } from './enquiries'
import { ResourceEditor, ResourcesList } from './ResourcesAdmin'
import InsightsPage from './InsightsPage'
import { LogPage, RoutinesPage } from './OtherPages'
import TodayPage from './TodayPage'
import { ProjectPage, ProjectsPage } from './ProjectsPage'
import Sidebar from './Sidebar'
import TaskModal from './TaskModal'
import { buildBackup, parseBackup, toDateStr, useAdminStore, useNow } from './store'
import './admin.css'

const PAGE_TITLES = { today: 'Today', projects: 'Projects', project: 'Project', routines: 'Routines', insights: 'Insights', log: 'Log', enquiries: 'Enquiries', content: 'Site content', resources: 'Resources', resource: 'Resource' }
const COLLAPSE_KEY = 'cb-admin-collapsed'

function parseRoute() {
  const [name, id] = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (name === 'projects' && id) return { name: 'project', id: decodeURIComponent(id) }
  if (name === 'resources' && id) return { name: 'resource', id: decodeURIComponent(id) }
  return { name: ['today', 'projects', 'routines', 'insights', 'log', 'enquiries', 'content', 'resources'].includes(name) ? name : 'projects' }
}

const isTyping = (el) => el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

export default function AdminApp({ user, onSignOut }) {
  const { state, dispatch, saveError } = useAdminStore()
  const syncStatus = useCloudSync(state, dispatch, user.id)
  const enquiries = useEnquiries()
  const [route, setRoute] = useState(parseRoute)
  const [editing, setEditing] = useState(null) // { kind: 'task' | 'project' | 'routine' | 'categories', ... }
  const [toastItem, setToastItem] = useState(null)
  const [today, setToday] = useState(toDateStr)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const now = useNow(Boolean(state.timer))
  const importInput = useRef(null)
  const toastTimer = useRef(null)

  useEffect(() => {
    const onHash = () => setRoute(parseRoute())
    window.addEventListener('hashchange', onHash)
    // Dates roll over at midnight without a reload.
    const tick = setInterval(() => setToday(toDateStr()), 60000)
    return () => {
      window.removeEventListener('hashchange', onHash)
      clearInterval(tick)
    }
  }, [])

  const project = route.name === 'project' ? state.projects.find((p) => p.id === route.id) : null
  useEffect(() => {
    const title = route.name === 'project' ? project?.name ?? 'Project' : PAGE_TITLES[route.name]
    document.title = `${title} | Task Manager`
  }, [route, project])

  const toast = useCallback((message, action) => {
    clearTimeout(toastTimer.current)
    setToastItem({ message, action })
    toastTimer.current = setTimeout(() => setToastItem(null), action ? 8000 : 4000)
  }, [])

  const go = (hash) => {
    window.location.hash = hash
  }

  // ---- openers
  const openTask = useCallback((id) => setEditing({ kind: 'task', id }), [])
  const newTask = useCallback((defaults) => setEditing({ kind: 'task', isNew: true, defaults }), [])
  const newProject = useCallback(() => setEditing({ kind: 'project', isNew: true }), [])
  const editProject = useCallback((id) => setEditing({ kind: 'project', id }), [])
  const newRoutine = useCallback(() => setEditing({ kind: 'routine', isNew: true }), [])
  const editRoutine = useCallback((id) => setEditing({ kind: 'routine', id }), [])
  const editCategories = useCallback(() => setEditing({ kind: 'categories' }), [])
  const toggleTimer = useCallback(
    (taskId) => dispatch({ type: state.timer?.taskId === taskId ? 'STOP_TIMER' : 'START_TIMER', taskId }),
    [dispatch, state.timer],
  )

  // N for a new task (when not typing in a field and no editor is open).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'n' || e.metaKey || e.ctrlKey || e.altKey || editing || isTyping(e.target)) return
      e.preventDefault()
      newTask()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, newTask])

  // An editor for something that no longer exists (deleted in another tab) just closes.
  const current = useMemo(() => {
    if (!editing || editing.isNew) return null
    if (editing.kind === 'task') return state.tasks.find((t) => t.id === editing.id) ?? null
    if (editing.kind === 'project') return state.projects.find((p) => p.id === editing.id) ?? null
    if (editing.kind === 'routine') return state.routines.find((r) => r.id === editing.id) ?? null
    return null
  }, [editing, state])
  useEffect(() => {
    if (editing && !editing.isNew && editing.kind !== 'categories' && !current) setEditing(null)
  }, [editing, current])

  // ---- saving and deleting
  const saveTask = (draft, isNew) => {
    if (isNew) {
      dispatch({ type: 'ADD_TASK', task: draft })
      toast('Task created')
    } else {
      dispatch({ type: 'UPDATE_TASK', id: draft.id, patch: draft })
      toast('Changes saved')
    }
    setEditing(null)
  }

  const deleteTask = (task) => {
    const index = state.tasks.findIndex((t) => t.id === task.id)
    dispatch({ type: 'DELETE_TASK', id: task.id })
    setEditing(null)
    toast(`Deleted “${task.title}”`, { label: 'Undo', run: () => dispatch({ type: 'RESTORE_TASK', task, index }) })
  }

  const saveProject = (draft, isNew) => {
    if (isNew) {
      dispatch({ type: 'ADD_PROJECT', project: draft })
      toast('Project created')
      go(`#/projects/${draft.id}`)
    } else {
      dispatch({ type: 'UPDATE_PROJECT', id: draft.id, patch: draft })
      toast('Changes saved')
    }
    setEditing(null)
  }

  const deleteProject = (proj) => {
    const tasks = state.tasks.filter((t) => t.projectId === proj.id)
    const message = tasks.length ? `Delete “${proj.name}” and its ${tasks.length} task${tasks.length === 1 ? '' : 's'}?` : `Delete “${proj.name}”?`
    if (!window.confirm(message)) return
    const index = state.projects.findIndex((p) => p.id === proj.id)
    dispatch({ type: 'DELETE_PROJECT', id: proj.id })
    setEditing(null)
    if (route.name === 'project' && route.id === proj.id) go('#/projects')
    toast(`Deleted “${proj.name}”`, { label: 'Undo', run: () => dispatch({ type: 'RESTORE_PROJECT', project: proj, index, tasks }) })
  }

  const saveRoutine = (draft, isNew) => {
    dispatch(isNew ? { type: 'ADD_ROUTINE', routine: draft } : { type: 'UPDATE_ROUTINE', id: draft.id, patch: draft })
    toast(isNew ? 'Routine created' : 'Changes saved')
    setEditing(null)
  }

  const deleteRoutine = (routine) => {
    if (!window.confirm(`Delete the routine “${routine.name}”?`)) return
    dispatch({ type: 'DELETE_ROUTINE', id: routine.id })
    setEditing(null)
    toast('Routine deleted')
  }

  // ---- backup
  const exportBackup = () => {
    const url = URL.createObjectURL(new Blob([buildBackup(state)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `tasks-backup-${toDateStr()}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    toast(`Backup downloaded (${state.tasks.length} tasks)`)
  }

  const importBackup = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const incoming = parseBackup(await file.text())
      const ok = window.confirm(
        `Replace your ${state.tasks.length} current task${state.tasks.length === 1 ? '' : 's'} and ${state.projects.length} project${state.projects.length === 1 ? '' : 's'} with the ${incoming.tasks.length} task${incoming.tasks.length === 1 ? '' : 's'} and ${incoming.projects.length} project${incoming.projects.length === 1 ? '' : 's'} in this backup?`,
      )
      if (!ok) return
      dispatch({ type: 'REPLACE', state: incoming })
      toast(`Imported ${incoming.tasks.length} task${incoming.tasks.length === 1 ? '' : 's'}`)
    } catch (err) {
      toast(err.message)
    }
  }

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        // The choice just is not remembered.
      }
      return !c
    })

  const ctx = useMemo(
    () => ({ state, dispatch, today, now, openTask, newTask, newProject, editProject, newRoutine, editRoutine, editCategories, toggleTimer, toast, enquiries, syncStatus, user, onSignOut }),
    [enquiries, syncStatus, user, onSignOut, state, dispatch, today, now, openTask, newTask, newProject, editProject, newRoutine, editRoutine, editCategories, toggleTimer, toast],
  )

  return (
    <AdminContext.Provider value={ctx}>
      <div className={`adm${collapsed ? ' is-collapsed' : ''}`}>
        <Sidebar route={route} collapsed={collapsed} onToggle={toggleCollapsed} onExport={exportBackup} onImport={() => importInput.current?.click()} />
        <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={importBackup} />

        <main className="adm-main">
          {saveError && (
            <p className="adm-banner" role="alert">
              Your browser is blocking storage, so changes will be lost when you close this tab. Export a backup to keep them.
            </p>
          )}
          {route.name === 'today' && <TodayPage />}
          {route.name === 'projects' && <ProjectsPage />}
          {route.name === 'project' && <ProjectPage id={route.id} />}
          {route.name === 'routines' && <RoutinesPage />}
          {route.name === 'insights' && <InsightsPage />}
          {route.name === 'log' && <LogPage />}
          {route.name === 'enquiries' && <EnquiriesPage />}
          {route.name === 'content' && <ContentPage />}
          {route.name === 'resources' && <ResourcesList />}
          {route.name === 'resource' && <ResourceEditor key={route.id} id={route.id} />}
        </main>

        {editing?.kind === 'task' && (
          <TaskModal key={editing.isNew ? 'new' : editing.id} task={current} defaults={editing.defaults} onSave={saveTask} onDelete={deleteTask} onClose={() => setEditing(null)} />
        )}
        {editing?.kind === 'project' && (
          <ProjectModal key={editing.isNew ? 'new' : editing.id} project={current} onSave={saveProject} onDelete={deleteProject} onClose={() => setEditing(null)} />
        )}
        {editing?.kind === 'routine' && (
          <RoutineModal key={editing.isNew ? 'new' : editing.id} routine={current} onSave={saveRoutine} onDelete={deleteRoutine} onClose={() => setEditing(null)} />
        )}
        {editing?.kind === 'categories' && (
          <CategoriesModal
            onSave={(categories) => {
              dispatch({ type: 'SET_CATEGORIES', categories })
              toast('Categories saved')
              setEditing(null)
            }}
            onClose={() => setEditing(null)}
          />
        )}

        {toastItem && (
          <div className="adm-toast" role="status">
            <span>{toastItem.message}</span>
            {toastItem.action && (
              <button
                type="button"
                onClick={() => {
                  toastItem.action.run()
                  setToastItem(null)
                }}
              >
                {toastItem.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </AdminContext.Provider>
  )
}
