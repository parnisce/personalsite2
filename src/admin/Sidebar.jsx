import { useEffect, useRef, useState } from 'react'
import {
  TbArrowLeft,
  TbChartBar,
  TbClockHour4,
  TbDownload,
  TbBook,
  TbChartLine,
  TbClipboardCheck,
  TbExternalLink,
  TbFileText,
  TbInbox,
  TbLogout,
  TbFolder,
  TbLayoutSidebar,
  TbPlayerStopFilled,
  TbPlus,
  TbRepeat,
  TbSettings,
  TbSun,
  TbTools,
  TbUpload,
} from 'react-icons/tb'
import LogoMark from '../components/LogoMark'
import { CONTACT } from '../data'
import { useAdmin } from './ctx'
import { DAY_LABELS, DAY_NAMES, categoryTimeThisWeek, formatClock, formatDuration, weekActivity } from './store'
import { CategoryDot } from './ui'

const SYNC_NOTE = {
  loading: 'Connecting to Supabase…',
  saving: 'Saving to Supabase…',
  synced: 'All changes saved to Supabase.',
  error: 'Could not reach Supabase. Changes stay in this browser and sync when it is back. Run supabase/schema.sql if you have not yet.',
}

const NAV = [
  { id: 'today', label: 'Today', Icon: TbSun },
  { id: 'projects', label: 'Projects', Icon: TbFolder },
  { id: 'routines', label: 'Routines', Icon: TbRepeat },
  { id: 'insights', label: 'Insights', Icon: TbChartBar },
  { id: 'log', label: 'Log', Icon: TbClockHour4 },
]

// A small popover: opens from `trigger`, closes on outside click or Escape.
function Menu({ trigger, label, align = 'left', children }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const button = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => !root.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="adm-menu" ref={root}>
      {trigger({ ref: button, open, toggle: () => setOpen((o) => !o), 'aria-haspopup': 'menu', 'aria-expanded': open })}
      {open && (
        <div className={`adm-menu-list is-${align}`} role="menu" aria-label={label} onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}

function TimerPill() {
  const { state, now, dispatch } = useAdmin()
  const task = state.timer && state.tasks.find((t) => t.id === state.timer.taskId)
  if (!task) return null
  const elapsed = now ? (now - new Date(state.timer.startedAt).getTime()) / 1000 : 0
  return (
    <div className="adm-timer" role="status">
      <i aria-hidden="true" />
      <span className="adm-timer-text">
        <strong>{task.title}</strong>
        <small className="adm-mono" aria-label="Elapsed time">
          {formatClock(elapsed)}
        </small>
      </span>
      <button type="button" className="adm-icon-btn" aria-label="Stop the timer" onClick={() => dispatch({ type: 'STOP_TIMER' })}>
        <TbPlayerStopFilled aria-hidden="true" />
      </button>
    </div>
  )
}

export default function Sidebar({ route, collapsed, onToggle, onExport, onImport }) {
  const { state, today, newTask, newProject, newRoutine, editCategories, enquiries, syncStatus, user, onSignOut } = useAdmin()
  const week = weekActivity(state, today)
  const catTime = categoryTimeThisWeek(state, today)
  const active = route.name === 'project' ? 'projects' : route.name

  return (
    <aside className={`adm-side${collapsed ? ' is-collapsed' : ''}`}>
      <div className="adm-side-top">
        <a href="#/projects" className="adm-brand" aria-label="Dashboard">
          <LogoMark size={30} />
          <span>Dashboard</span>
        </a>
        <button type="button" className="adm-icon-btn adm-collapse" aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'} aria-pressed={collapsed} onClick={onToggle}>
          <TbLayoutSidebar aria-hidden="true" />
        </button>
      </div>

      <Menu
        label="Create new"
        trigger={({ toggle, ...rest }) => (
          <button type="button" className="adm-new" onClick={toggle} {...rest}>
            <TbPlus aria-hidden="true" />
            <span>New</span>
            <kbd aria-hidden="true">N</kbd>
          </button>
        )}
      >
        <button type="button" role="menuitem" onClick={() => newTask()}>
          New task <kbd>N</kbd>
        </button>
        <button type="button" role="menuitem" onClick={newProject}>
          New project
        </button>
        <button type="button" role="menuitem" onClick={newRoutine}>
          New routine
        </button>
      </Menu>

      <TimerPill />

      <nav className="adm-nav" aria-label="Admin">
        {NAV.map(({ id, label, Icon }) => (
          <a key={id} href={`#/${id}`} className={active === id ? 'is-active' : ''} aria-current={active === id ? 'page' : undefined} title={collapsed ? label : undefined}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </a>
        ))}
      </nav>

      <div className="adm-side-extra">
        <p className="adm-caption">Website</p>
        <nav className="adm-nav" aria-label="Website">
          <a href="#/enquiries" className={active === 'enquiries' ? 'is-active' : ''} title={collapsed ? 'Enquiries' : undefined}>
            <TbInbox aria-hidden="true" />
            <span>Enquiries</span>
            {enquiries.unread > 0 && <b className="adm-badge">{enquiries.unread}</b>}
          </a>
          <a href="#/resources" className={active === 'resources' || active === 'resource' ? 'is-active' : ''} title={collapsed ? 'Resources' : undefined}>
            <TbBook aria-hidden="true" />
            <span>Resources</span>
          </a>
          <a href="#/analytics" className={active === 'analytics' ? 'is-active' : ''} title={collapsed ? 'Analytics' : undefined}>
            <TbChartLine aria-hidden="true" />
            <span>Analytics</span>
          </a>
          <a href="#/audit" className={active === 'audit' ? 'is-active' : ''} title={collapsed ? 'Internal audit' : undefined}>
            <TbClipboardCheck aria-hidden="true" />
            <span>Internal audit</span>
          </a>
          <a href="#/content" className={active === 'content' ? 'is-active' : ''} title={collapsed ? 'Site content' : undefined}>
            <TbFileText aria-hidden="true" />
            <span>Site content</span>
          </a>
          <a href="/" title={collapsed ? 'View site' : undefined}>
            <TbExternalLink aria-hidden="true" />
            <span>View site</span>
          </a>
          <a href="/tools/" title={collapsed ? 'Free tools' : undefined}>
            <TbTools aria-hidden="true" />
            <span>Free tools</span>
          </a>
        </nav>

        <div className="adm-caption-row">
          <p className="adm-caption">Categories</p>
          <button type="button" className="adm-textbtn" onClick={editCategories}>
            Edit
          </button>
        </div>
        <ul className="adm-sidecats">
          {state.categories.map((c) => (
            <li key={c.id}>
              <CategoryDot color={c.color} />
              <span>{c.name}</span>
              {catTime[c.id] > 0 && <small className="adm-mono">{formatDuration(catTime[c.id])}</small>}
            </li>
          ))}
        </ul>
      </div>

      <div className="adm-side-bottom">
        <div className="adm-week">
          <p className="adm-caption">This week</p>
          <div className="adm-week-days" role="img" aria-label={`Days active this week: ${week.filter((d) => d.active).length} of 7`}>
            {week.map((d, i) => (
              <span key={d.date} title={`${DAY_NAMES[i]}${d.seconds ? `: ${formatDuration(d.seconds)}` : ''}`} className={`${d.active ? 'is-active' : ''}${d.isToday ? ' is-today' : ''}`}>
                <b>{DAY_LABELS[i]}</b>
                <i />
              </span>
            ))}
          </div>
        </div>

        <div className="adm-profile">
          <span className="adm-avatar" aria-hidden="true">
            C
          </span>
          <span className="adm-profile-text">
            <strong>Cyryl</strong>
            <small>{user.email ?? CONTACT.email}</small>
          </span>
          <Menu
            label="Settings"
            align="top"
            trigger={({ toggle, ...rest }) => (
              <button type="button" className="adm-icon-btn" aria-label="Settings and backup" onClick={toggle} {...rest}>
                <TbSettings aria-hidden="true" />
              </button>
            )}
          >
            <button type="button" role="menuitem" onClick={onExport}>
              <TbDownload aria-hidden="true" /> Export backup
            </button>
            <button type="button" role="menuitem" onClick={onImport}>
              <TbUpload aria-hidden="true" /> Import backup
            </button>
            <a role="menuitem" href="/">
              <TbArrowLeft aria-hidden="true" /> Back to site
            </a>
            <button type="button" role="menuitem" onClick={onSignOut}>
              <TbLogout aria-hidden="true" /> Sign out
            </button>
            <p className="adm-menu-note">{SYNC_NOTE[syncStatus]}</p>
          </Menu>
        </div>
      </div>
    </aside>
  )
}
