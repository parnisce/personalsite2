import { useEffect, useReducer, useState } from 'react'

// The task manager keeps everything in the browser (localStorage), so it works without a server.
// Data lives on this device only; the backup export / import moves it elsewhere.
//
// Model: categories group projects, projects hold tasks, tasks collect time entries. Tasks with
// no project are "quick tasks". Routines are repeating habits ticked off day by day.

export const STATUSES = [
  { id: 'open', label: 'Open', color: '#8f8c86' },
  { id: 'doing', label: 'In progress', color: '#8b7cf6' },
  { id: 'blocked', label: 'Blocked', color: '#ff4d6d' },
  { id: 'done', label: 'Done', color: '#2fbf8a' },
]

export const PRIORITIES = [
  { id: 'urgent', label: 'Urgent', rank: 0 },
  { id: 'high', label: 'High', rank: 1 },
  { id: 'medium', label: 'Medium', rank: 2 },
  { id: 'low', label: 'Low', rank: 3 },
]

export const CATEGORY_COLORS = ['#00e5ff', '#8b7cf6', '#2fbf8a', '#4a8cff', '#ff4d6d', '#f5b83d', '#ff8a3d', '#c26bd9']

// The first version of the admin used orange as its default; saved data moves to the new default.
const LEGACY_ORANGE = '#ff6a2b'

export const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] // Monday first
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const STORAGE_KEY = 'cb-admin-v2'
const LEGACY_KEY = 'cb-admin-tasks-v1'
const STATUS_IDS = STATUSES.map((s) => s.id)
const PRIORITY_IDS = PRIORITIES.map((p) => p.id)
const MAX_ACTIVITY = 150
const MAX_ENTRIES = 3000

export const statusOf = (id) => STATUSES.find((s) => s.id === id) ?? STATUSES[0]
export const statusLabel = (id) => statusOf(id).label
export const priorityRank = (id) => PRIORITIES.find((p) => p.id === id)?.rank ?? 2

export const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`

// ---------------------------------------------------------------- dates (local, not UTC)

const pad = (n) => String(n).padStart(2, '0')
export const toDateStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function parseDate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str ?? '')
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

export const addDays = (str, n) => {
  const d = parseDate(str) ?? new Date()
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

// Whole days from a to b (positive when b is later).
export const daysBetween = (a, b) => {
  const x = parseDate(a)
  const y = parseDate(b)
  return x && y ? Math.round((y - x) / 86400000) : 0
}

// Monday = 0 ... Sunday = 6
export const weekdayIndex = (str) => ((parseDate(str)?.getDay() ?? 1) + 6) % 7

// The seven dates (Monday to Sunday) of the week containing `today`.
export const weekDates = (today) => {
  const monday = addDays(today, -weekdayIndex(today))
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export const localDay = (iso) => toDateStr(new Date(iso))

export function dueState(task, today) {
  if (!task.dueDate) return 'none'
  if (task.status === 'done') return 'done'
  const diff = daysBetween(today, task.dueDate)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff <= 3) return 'soon'
  return 'later'
}

// Day before month ("24 Oct"), as on the dashboard this is modelled on.
export const shortDate = (str) => {
  const d = parseDate(str)
  return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''
}

export function formatDue(str, today = toDateStr()) {
  const diff = daysBetween(today, str)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return shortDate(str)
}

// "Due 24 Oct" / "Overdue 19 Oct" style text used on chips.
export function dueChipText(item, today) {
  if (!item.dueDate) return ''
  const done = item.status === 'done'
  return !done && item.dueDate < today ? `Overdue ${shortDate(item.dueDate)}` : `Due ${shortDate(item.dueDate)}`
}

// "1 day late", "due today", "in 3 days"
export function dueDistance(str, today) {
  const diff = daysBetween(today, str)
  if (diff < 0) return `${-diff} day${diff === -1 ? '' : 's'} late`
  if (diff === 0) return 'Due today'
  return `in ${diff} day${diff === 1 ? '' : 's'}`
}

export const longDate = (str) => parseDate(str)?.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '') ?? ''

export function formatWhen(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const sameDay = toDateStr(d) === toDateStr()
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return sameDay ? `Today, ${time}` : `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`
}

// "0M", "12M", "1H 20M", "4H" (seconds in)
export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds))
  if (!s) return '0M'
  const minutes = Math.max(1, Math.round(s / 60))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? (m ? `${h}H ${m}M` : `${h}H`) : `${m}M`
}

export const formatClock = (seconds) => {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h ? `${h}:${pad(m)}` : m}:${pad(s % 60)}`
}

// ---------------------------------------------------------------- shapes

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const iso = (v) => (typeof v === 'string' && !Number.isNaN(new Date(v).getTime()) ? v : null)

export const DEFAULT_CATEGORIES = [
  { id: 'work', name: 'Work', color: CATEGORY_COLORS[0] },
  { id: 'side', name: 'Side projects', color: CATEGORY_COLORS[1] },
  { id: 'social', name: 'Social', color: CATEGORY_COLORS[2] },
  { id: 'rest', name: 'Rest', color: CATEGORY_COLORS[3] },
]

export function makeTask(partial = {}) {
  const now = new Date().toISOString()
  return {
    id: uid(),
    projectId: null,
    title: '',
    description: '',
    status: 'open',
    priority: 'medium',
    dueDate: '',
    labels: [],
    subtasks: [],
    estimate: 0, // minutes; 0 means no estimate
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    ...partial,
  }
}

export function makeProject(partial = {}) {
  return { id: uid(), name: '', categoryId: 'work', dueDate: '', description: '', createdAt: new Date().toISOString(), ...partial }
}

export function makeRoutine(partial = {}) {
  return { id: uid(), name: '', categoryId: 'rest', days: [0, 1, 2, 3, 4], done: {}, createdAt: new Date().toISOString(), ...partial }
}

const LEGACY_STATUS = { todo: 'open', review: 'doing' }

export function normalizeTask(t) {
  if (!t || typeof t !== 'object') return null
  const title = str(t.title, 200)
  if (!title) return null
  const rawStatus = LEGACY_STATUS[t.status] ?? t.status
  const status = STATUS_IDS.includes(rawStatus) ? rawStatus : 'open'
  const now = new Date().toISOString()
  return {
    id: typeof t.id === 'string' && t.id ? t.id : uid(),
    projectId: typeof t.projectId === 'string' && t.projectId ? t.projectId : null,
    title,
    description: typeof t.description === 'string' ? t.description.slice(0, 5000) : '',
    status,
    priority: PRIORITY_IDS.includes(t.priority) ? t.priority : 'medium',
    dueDate: parseDate(t.dueDate) ? t.dueDate : '',
    labels: [...new Set((Array.isArray(t.labels) ? t.labels : []).map((l) => str(l, 24).toLowerCase()).filter(Boolean))].slice(0, 8),
    subtasks: (Array.isArray(t.subtasks) ? t.subtasks : [])
      .map((s) => ({ id: typeof s?.id === 'string' && s.id ? s.id : uid(), text: str(s?.text, 200), done: Boolean(s?.done) }))
      .filter((s) => s.text)
      .slice(0, 50),
    estimate: Number.isFinite(Number(t.estimate)) ? Math.min(Math.max(Math.round(Number(t.estimate)), 0), 99999) : 0,
    createdAt: iso(t.createdAt) ?? now,
    updatedAt: iso(t.updatedAt) ?? now,
    completedAt: status === 'done' ? iso(t.completedAt) ?? iso(t.updatedAt) ?? now : null,
  }
}

function normalizeCategories(list) {
  const clean = (Array.isArray(list) ? list : [])
    .map((c) => ({ id: typeof c?.id === 'string' && c.id ? c.id : uid(), name: str(c?.name, 40), color: /^#[0-9a-f]{6}$/i.test(c?.color) ? (c.color.toLowerCase() === LEGACY_ORANGE ? CATEGORY_COLORS[0] : c.color) : CATEGORY_COLORS[0] }))
    .filter((c) => c.name)
    .slice(0, 12)
  return clean.length ? clean : DEFAULT_CATEGORIES.map((c) => ({ ...c }))
}

export function normalizeState(raw) {
  const categories = normalizeCategories(raw?.categories)
  const categoryIds = new Set(categories.map((c) => c.id))
  const firstCategory = categories[0].id

  const projects = (Array.isArray(raw?.projects) ? raw.projects : [])
    .map((p) => ({
      id: typeof p?.id === 'string' && p.id ? p.id : uid(),
      name: str(p?.name, 120),
      categoryId: categoryIds.has(p?.categoryId) ? p.categoryId : firstCategory,
      dueDate: parseDate(p?.dueDate) ? p.dueDate : '',
      description: typeof p?.description === 'string' ? p.description.slice(0, 2000) : '',
      createdAt: iso(p?.createdAt) ?? new Date().toISOString(),
    }))
    .filter((p) => p.name)
  const projectIds = new Set(projects.map((p) => p.id))

  const tasks = (Array.isArray(raw?.tasks) ? raw.tasks : []).map(normalizeTask).filter(Boolean)
  const seen = new Set()
  tasks.forEach((t) => {
    if (seen.has(t.id)) t.id = uid() // repeats would break drag and drop
    seen.add(t.id)
    if (t.projectId && !projectIds.has(t.projectId)) t.projectId = null
  })

  const entries = (Array.isArray(raw?.entries) ? raw.entries : [])
    .filter((e) => e && iso(e.start) && Number(e.seconds) > 0)
    .map((e) => ({
      id: typeof e.id === 'string' && e.id ? e.id : uid(),
      taskId: str(e.taskId, 80),
      projectId: projectIds.has(e.projectId) ? e.projectId : null,
      title: str(e.title, 200) || 'Task',
      start: e.start,
      seconds: Math.min(Math.round(Number(e.seconds)), 86400 * 2),
    }))
    .slice(0, MAX_ENTRIES)

  const routines = (Array.isArray(raw?.routines) ? raw.routines : [])
    .map((r) => ({
      id: typeof r?.id === 'string' && r.id ? r.id : uid(),
      name: str(r?.name, 120),
      categoryId: categoryIds.has(r?.categoryId) ? r.categoryId : firstCategory,
      days: [...new Set((Array.isArray(r?.days) ? r.days : []).map(Number).filter((d) => d >= 0 && d <= 6))].sort(),
      done: Object.fromEntries(Object.entries(r?.done && typeof r.done === 'object' ? r.done : {}).filter(([k, v]) => parseDate(k) && v).map(([k]) => [k, true])),
      createdAt: iso(r?.createdAt) ?? new Date().toISOString(),
    }))
    .filter((r) => r.name)

  const activity = (Array.isArray(raw?.activity) ? raw.activity : [])
    .filter((a) => a && typeof a.text === 'string' && iso(a.at))
    .map((a) => ({ id: typeof a.id === 'string' ? a.id : uid(), at: a.at, taskId: str(a.taskId, 80), title: str(a.title, 200), text: str(a.text, 200) }))
    .slice(0, MAX_ACTIVITY)

  const timer = raw?.timer && typeof raw.timer.taskId === 'string' && iso(raw.timer.startedAt) && tasks.some((t) => t.id === raw.timer.taskId) ? { taskId: raw.timer.taskId, startedAt: raw.timer.startedAt } : null

  return { version: 2, categories, projects, tasks, routines, entries, activity, timer }
}

// Version 1 had no projects; people's clients become projects so nothing is lost.
function migrateV1(raw) {
  const tasks = (Array.isArray(raw?.tasks) ? raw.tasks : []).filter((t) => t && typeof t === 'object')
  const byClient = new Map()
  tasks.forEach((t) => {
    const client = str(t.client, 80)
    if (client && !byClient.has(client)) byClient.set(client, { id: uid(), name: client, categoryId: 'work' })
  })
  return normalizeState({
    categories: DEFAULT_CATEGORIES,
    projects: [...byClient.values()],
    tasks: tasks.map((t) => ({ ...t, projectId: byClient.get(str(t.client, 80))?.id ?? null })),
    activity: raw?.activity,
  })
}

export const parseAny = (raw) => (raw?.version === 2 ? normalizeState(raw) : migrateV1(raw))

// ---------------------------------------------------------------- example data (first visit)

function seedState() {
  const today = toDateStr()
  const ago = (days, hour = 10) => {
    const d = new Date()
    d.setDate(d.getDate() - days)
    d.setHours(hour, 0, 0, 0)
    return d.toISOString()
  }
  const sub = (text, done = false) => ({ id: uid(), text, done })
  const site = makeProject({ name: 'Portfolio Website', categoryId: 'work', dueDate: addDays(today, 10), description: 'Launch the new portfolio and keep it sharp.' })
  const tools = makeProject({ name: 'Free Tools', categoryId: 'side', dueDate: addDays(today, 14), description: 'Browser tools that run on your own site.' })

  const formKey = makeTask({
    projectId: site.id,
    title: 'Test the contact form',
    description: 'The contact form opens the visitor’s email app with the enquiry filled in. Check it works on desktop and phone.',
    status: 'doing',
    priority: 'urgent',
    dueDate: addDays(today, 1),
    labels: ['website'],
    estimate: 20,
    subtasks: [sub('Fill in the form', true), sub('Check the email app opens with the details'), sub('Try it on a phone')],
  })
  const screenshots = makeTask({ projectId: site.id, title: 'Add real project screenshots to the Work section', description: 'Replace the placeholder artwork on the three project cards with screenshots of the live sites.', priority: 'high', dueDate: addDays(today, 6), labels: ['content'], estimate: 90 })
  const deploy = makeTask({
    projectId: site.id,
    title: 'Deploy the site',
    description: 'Pick a host, run the production build and point the domain at it.',
    priority: 'high',
    dueDate: addDays(today, 10),
    labels: ['website'],
    estimate: 120,
    subtasks: [sub('Choose a host'), sub('Run npm run build'), sub('Upload the dist folder'), sub('Connect the domain')],
  })
  const proofread = makeTask({ projectId: site.id, title: 'Proofread the homepage copy', status: 'blocked', priority: 'medium', dueDate: addDays(today, -1), labels: ['content'], description: 'Waiting on final wording for the About section.' })
  const contact = makeTask({ projectId: site.id, title: 'Build the contact form', status: 'done', priority: 'high', labels: ['website'], createdAt: ago(4), completedAt: ago(1) })
  const heic = makeTask({ projectId: tools.id, title: 'Test HEIC to JPG with a real iPhone photo', priority: 'medium', dueDate: addDays(today, 4), labels: ['testing'] })
  const toolsPage = makeTask({ projectId: tools.id, title: 'Create the Free Tools page', status: 'done', priority: 'medium', labels: ['tools'], createdAt: ago(6), completedAt: ago(3) })
  const transcriber = makeTask({ projectId: tools.id, title: 'Add the video transcriber', status: 'done', priority: 'medium', labels: ['tools'], createdAt: ago(5), completedAt: ago(2) })
  const asks = makeTask({ title: 'Ask two clients for LinkedIn recommendations', priority: 'low', dueDate: addDays(today, 14), labels: ['content'] })
  const tasks = [formKey, screenshots, deploy, proofread, contact, heic, toolsPage, transcriber, asks]

  const entry = (task, projectId, days, hour, minutes) => ({ id: uid(), taskId: task.id, projectId, title: task.title, start: ago(days, hour), seconds: minutes * 60 })
  const entries = [entry(contact, site.id, 3, 9, 95), entry(transcriber, tools.id, 2, 14, 140), entry(toolsPage, tools.id, 3, 15, 75), entry(formKey, site.id, 0, 9, 25)]

  const routines = [
    makeRoutine({ name: 'Reply to enquiries', categoryId: 'work', days: [0, 1, 2, 3, 4] }),
    makeRoutine({ name: 'Back up the task board', categoryId: 'work', days: [4] }),
  ]
  const activity = [
    { id: uid(), at: ago(1), taskId: contact.id, title: contact.title, text: 'Marked as done' },
    { id: uid(), at: ago(2), taskId: transcriber.id, title: transcriber.title, text: 'Marked as done' },
    { id: uid(), at: new Date().toISOString(), taskId: formKey.id, title: formKey.title, text: 'Created' },
  ]
  return { version: 2, categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })), projects: [site, tools], tasks, routines, entries, activity, timer: null }
}

// ---------------------------------------------------------------- reducer

const log = (state, task, text) => ({
  ...state,
  activity: [{ id: uid(), at: new Date().toISOString(), taskId: task.id, title: task.title, text }, ...state.activity].slice(0, MAX_ACTIVITY),
})

// Puts task `id` into column `status`, just before `beforeId` (or at the end of that column).
function place(tasks, id, status, beforeId) {
  const moving = tasks.find((t) => t.id === id)
  if (!moving) return tasks
  const rest = tasks.filter((t) => t.id !== id)
  const moved = { ...moving, status }
  let at = beforeId ? rest.findIndex((t) => t.id === beforeId) : -1
  if (at === -1) {
    const lastInColumn = rest.map((t) => t.status).lastIndexOf(status)
    at = lastInColumn === -1 ? rest.length : lastInColumn + 1
  }
  return [...rest.slice(0, at), moved, ...rest.slice(at)]
}

const withStatus = (task, status) => {
  const now = new Date().toISOString()
  return { ...task, status, updatedAt: now, completedAt: status === 'done' ? task.completedAt ?? now : null }
}

// Ends the running timer and records the time it ran for.
function stopTimer(state) {
  if (!state.timer) return state
  const task = state.tasks.find((t) => t.id === state.timer.taskId)
  const seconds = Math.round((Date.now() - new Date(state.timer.startedAt).getTime()) / 1000)
  const entries =
    seconds >= 1 && task
      ? [{ id: uid(), taskId: task.id, projectId: task.projectId, title: task.title, start: state.timer.startedAt, seconds: Math.min(seconds, 86400) }, ...state.entries].slice(0, MAX_ENTRIES)
      : state.entries
  return { ...state, timer: null, entries }
}

export function reducer(state, action) {
  switch (action.type) {
    case 'ADD_TASK': {
      const task = normalizeTask({ ...action.task, id: action.task.id ?? uid() })
      if (!task) return state
      return log({ ...state, tasks: place([...state.tasks, task], task.id, task.status, null) }, task, 'Created')
    }
    case 'UPDATE_TASK': {
      const old = state.tasks.find((t) => t.id === action.id)
      if (!old) return state
      const merged = normalizeTask({ ...old, ...action.patch, id: old.id, createdAt: old.createdAt })
      if (!merged) return state
      const next = { ...merged, updatedAt: new Date().toISOString(), completedAt: merged.status === 'done' ? old.completedAt ?? new Date().toISOString() : null }
      let out = { ...state, tasks: state.tasks.map((t) => (t.id === old.id ? next : t)) }
      if (old.status !== next.status) {
        out = { ...out, tasks: place(out.tasks, next.id, next.status, null) }
        out = log(out, next, next.status === 'done' ? 'Marked as done' : `Moved to ${statusLabel(next.status)}`)
        if (next.status === 'done' && out.timer?.taskId === next.id) out = stopTimer(out)
      }
      if (old.priority !== next.priority) out = log(out, next, `Priority set to ${next.priority}`)
      if (old.dueDate !== next.dueDate) out = log(out, next, next.dueDate ? `Due date set to ${formatDue(next.dueDate)}` : 'Due date removed')
      return out
    }
    case 'MOVE_TASK': {
      const task = state.tasks.find((t) => t.id === action.id)
      if (!task) return state
      const changed = task.status !== action.status
      let tasks = place(state.tasks, action.id, action.status, action.beforeId)
      if (changed) tasks = tasks.map((t) => (t.id === action.id ? withStatus(t, action.status) : t))
      let out = { ...state, tasks }
      if (changed) {
        out = log(out, task, action.status === 'done' ? 'Marked as done' : `Moved to ${statusLabel(action.status)}`)
        if (action.status === 'done' && out.timer?.taskId === task.id) out = stopTimer(out)
      }
      return out
    }
    case 'DELETE_TASK': {
      const out = state.timer?.taskId === action.id ? stopTimer(state) : state
      return { ...out, tasks: out.tasks.filter((t) => t.id !== action.id) }
    }
    case 'RESTORE_TASK': {
      const tasks = [...state.tasks]
      tasks.splice(Math.min(action.index, tasks.length), 0, action.task)
      return { ...state, tasks }
    }

    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, normalizeState({ projects: [action.project], categories: state.categories }).projects[0] ?? action.project] }
    case 'UPDATE_PROJECT':
      return { ...state, projects: state.projects.map((p) => (p.id === action.id ? { ...p, ...action.patch, id: p.id } : p)) }
    case 'DELETE_PROJECT': {
      const out = state.timer && state.tasks.find((t) => t.id === state.timer.taskId)?.projectId === action.id ? stopTimer(state) : state
      return { ...out, projects: out.projects.filter((p) => p.id !== action.id), tasks: out.tasks.filter((t) => t.projectId !== action.id) }
    }
    case 'RESTORE_PROJECT': {
      const projects = [...state.projects]
      projects.splice(Math.min(action.index, projects.length), 0, action.project)
      return { ...state, projects, tasks: [...state.tasks, ...action.tasks] }
    }
    case 'SET_CATEGORIES': {
      const categories = normalizeCategories(action.categories)
      const ids = new Set(categories.map((c) => c.id))
      const fallback = categories[0].id
      return {
        ...state,
        categories,
        projects: state.projects.map((p) => (ids.has(p.categoryId) ? p : { ...p, categoryId: fallback })),
        routines: state.routines.map((r) => (ids.has(r.categoryId) ? r : { ...r, categoryId: fallback })),
      }
    }

    case 'START_TIMER': {
      const task = state.tasks.find((t) => t.id === action.taskId)
      if (!task) return state
      let out = stopTimer(state)
      out = { ...out, timer: { taskId: task.id, startedAt: new Date().toISOString() } }
      if (task.status === 'open' || task.status === 'blocked') {
        out = { ...out, tasks: place(out.tasks.map((t) => (t.id === task.id ? withStatus(t, 'doing') : t)), task.id, 'doing', null) }
        out = log(out, task, 'Moved to In progress')
      }
      return out
    }
    case 'STOP_TIMER':
      return stopTimer(state)
    case 'ADD_ENTRY': {
      const task = state.tasks.find((t) => t.id === action.taskId)
      if (!task || !(action.seconds > 0)) return state
      const entry = { id: uid(), taskId: task.id, projectId: task.projectId, title: task.title, start: action.start ?? new Date().toISOString(), seconds: Math.min(Math.round(action.seconds), 86400) }
      return log({ ...state, entries: [entry, ...state.entries].slice(0, MAX_ENTRIES) }, task, `Logged ${formatDuration(entry.seconds)}`)
    }
    case 'DELETE_ENTRY':
      return { ...state, entries: state.entries.filter((e) => e.id !== action.id) }

    case 'ADD_ROUTINE':
      return { ...state, routines: [...state.routines, action.routine] }
    case 'UPDATE_ROUTINE':
      return { ...state, routines: state.routines.map((r) => (r.id === action.id ? { ...r, ...action.patch, id: r.id } : r)) }
    case 'DELETE_ROUTINE':
      return { ...state, routines: state.routines.filter((r) => r.id !== action.id) }
    case 'TOGGLE_ROUTINE_DAY':
      return {
        ...state,
        routines: state.routines.map((r) => {
          if (r.id !== action.id) return r
          const done = { ...r.done }
          if (done[action.date]) delete done[action.date]
          else done[action.date] = true
          return { ...r, done }
        }),
      }

    case 'REPLACE':
      return action.state
    default:
      return state
  }
}

// ---------------------------------------------------------------- saving & loading

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw !== null) {
      try {
        return normalizeState(JSON.parse(raw))
      } catch {
        // Unreadable data is kept aside, never silently thrown away.
        localStorage.setItem(`${STORAGE_KEY}-unreadable`, raw)
        return normalizeState({})
      }
    }
    // First visit to this version: bring the older task list across, or start with examples.
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      try {
        return migrateV1(JSON.parse(legacy))
      } catch {
        // fall through to the examples
      }
    }
    return seedState()
  } catch {
    return seedState() // storage is blocked (private mode); everything still works for this visit
  }
}

export function useAdminStore() {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    try {
      const json = JSON.stringify(state)
      if (localStorage.getItem(STORAGE_KEY) !== json) localStorage.setItem(STORAGE_KEY, json)
      setSaveError(false)
    } catch {
      setSaveError(true)
    }
  }, [state])

  // Changes made in another tab show up here too.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      try {
        dispatch({ type: 'REPLACE', state: normalizeState(JSON.parse(e.newValue)) })
      } catch {
        // Ignore a half-written value.
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return { state, dispatch, saveError }
}

// Re-renders every second while `active`, for the running timer.
export function useNow(active) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!active) return undefined
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [active])
  return active ? now : 0
}

// ---------------------------------------------------------------- queries

export const timeFor = (entries, match) => entries.reduce((sum, e) => (match(e) ? sum + e.seconds : sum), 0)

// Seconds the running timer has been going (0 when it is not for this match).
export const runningSeconds = (timer, now, match) => (timer && now && match(timer) ? Math.max(0, Math.floor((now - new Date(timer.startedAt).getTime()) / 1000)) : 0)

export const taskSeconds = (state, task, now = 0) => timeFor(state.entries, (e) => e.taskId === task.id) + runningSeconds(state.timer, now, (t) => t.taskId === task.id)

const byDueThenPriority = (a, b) =>
  (a.dueDate && b.dueDate ? daysBetween(b.dueDate, a.dueDate) : a.dueDate ? -1 : b.dueDate ? 1 : 0) || priorityRank(a.priority) - priorityRank(b.priority)

export const nextTask = (tasks) => tasks.filter((t) => t.status !== 'done').sort(byDueThenPriority)[0] ?? null

export function projectStats(project, state, today) {
  const tasks = state.tasks.filter((t) => t.projectId === project.id)
  const done = tasks.filter((t) => t.status === 'done').length
  const count = (s) => tasks.filter((t) => t.status === s).length
  return {
    tasks,
    total: tasks.length,
    done,
    doing: count('doing'),
    blocked: count('blocked'),
    open: count('open'),
    percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    seconds: timeFor(state.entries, (e) => e.projectId === project.id),
    estimate: tasks.reduce((sum, t) => sum + (t.estimate || 0), 0),
    overdue: Boolean(project.dueDate && project.dueDate < today && !(tasks.length && done === tasks.length)),
    next: nextTask(tasks),
  }
}

// Which days of this week had any work: time logged, a task finished or a routine ticked.
export function weekActivity(state, today) {
  return weekDates(today).map((date) => {
    const seconds = timeFor(state.entries, (e) => localDay(e.start) === date)
    const finished = state.tasks.some((t) => t.completedAt && localDay(t.completedAt) === date)
    const routine = state.routines.some((r) => r.done[date])
    return { date, seconds, active: seconds > 0 || finished || routine, isToday: date === today }
  })
}

export function categoryTimeThisWeek(state, today) {
  const days = new Set(weekDates(today))
  const projectCategory = Object.fromEntries(state.projects.map((p) => [p.id, p.categoryId]))
  const totals = {}
  state.entries.forEach((e) => {
    if (!days.has(localDay(e.start))) return
    const key = projectCategory[e.projectId] ?? 'none'
    totals[key] = (totals[key] ?? 0) + e.seconds
  })
  return totals
}

export function routineStreak(routine, today) {
  let streak = 0
  let date = today
  // Today does not break a streak until the day is over.
  if (routine.days.includes(weekdayIndex(date)) && !routine.done[date]) date = addDays(date, -1)
  for (let i = 0; i < 400; i++) {
    if (routine.days.includes(weekdayIndex(date))) {
      if (!routine.done[date]) break
      streak += 1
    }
    date = addDays(date, -1)
  }
  return streak
}

export function filterTasks(tasks, { q = '', priority = '', label = '' } = {}) {
  const needle = q.trim().toLowerCase()
  return tasks.filter((t) => {
    if (priority && t.priority !== priority) return false
    if (label && !t.labels.includes(label)) return false
    if (!needle) return true
    return `${t.title} ${t.description} ${t.labels.join(' ')} ${t.subtasks.map((s) => s.text).join(' ')}`.toLowerCase().includes(needle)
  })
}

export const allLabels = (tasks) => [...new Set(tasks.flatMap((t) => t.labels))].sort()
export const subtaskProgress = (t) => ({ done: t.subtasks.filter((s) => s.done).length, total: t.subtasks.length })

// ---------------------------------------------------------------- backup

export function buildBackup(state) {
  const { categories, projects, tasks, routines, entries, activity, timer } = state
  return JSON.stringify({ app: 'cb-task-manager', version: 2, exportedAt: new Date().toISOString(), categories, projects, tasks, routines, entries, activity, timer }, null, 2)
}

export function parseBackup(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file is not a valid backup. It should be a .json file exported from this task manager.')
  }
  if (!data || !Array.isArray(data.tasks)) throw new Error('That file does not contain any tasks.')
  const state = parseAny(data)
  if (!state.tasks.length && data.tasks.length) throw new Error('None of the tasks in that file could be read.')
  return state
}
