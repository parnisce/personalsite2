import { TbChecklist } from 'react-icons/tb'
import { PRIORITIES, dueChipText, dueState, statusOf, subtaskProgress } from './store'

export function CategoryDot({ color }) {
  return <i className="adm-dot" style={{ background: color }} aria-hidden="true" />
}

export function PriorityChip({ priority }) {
  const label = PRIORITIES.find((p) => p.id === priority)?.label ?? priority
  return <span className={`adm-chip is-pri-${priority}`}>{label}</span>
}

export function StatusTag({ status }) {
  const s = statusOf(status)
  return (
    <span className="adm-statustag" style={{ '--c': s.color }}>
      <i aria-hidden="true" />
      {s.label}
    </span>
  )
}

// "Due 24 Oct" in grey, or "Overdue 19 Oct" in red.
export function DueChip({ item, today }) {
  if (!item.dueDate) return null
  const state = dueState(item, today)
  return <span className={`adm-chip is-due-${state}`}>{dueChipText(item, today)}</span>
}

export function LabelChips({ labels, max = 3 }) {
  if (!labels.length) return null
  return (
    <>
      {labels.slice(0, max).map((l) => (
        <span key={l} className="adm-chip is-label">
          {l}
        </span>
      ))}
      {labels.length > max && <span className="adm-chip is-label">+{labels.length - max}</span>}
    </>
  )
}

export function SubtaskMeter({ task }) {
  const { done, total } = subtaskProgress(task)
  if (!total) return null
  return (
    <span className={`adm-meter${done === total ? ' is-complete' : ''}`} title={`${done} of ${total} checklist steps done`}>
      <TbChecklist aria-hidden="true" />
      {done}/{total}
    </span>
  )
}

export function Bar({ value, color }) {
  return (
    <span className="adm-bar" role="presentation">
      <i style={{ width: `${Math.min(100, Math.max(0, value))}%`, ...(color && { background: color }) }} />
    </span>
  )
}

// Circular progress with the percentage in the middle.
export function Ring({ percent, size = 96, stroke = 7 }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <span className="adm-ring" style={{ width: size, height: size }} role="img" aria-label={`${percent}% complete`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="adm-ring-track" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - percent / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="adm-ring-value"
        />
      </svg>
      <strong>{percent}%</strong>
    </span>
  )
}

export function Segmented({ label, options, value, onChange }) {
  return (
    <div className="adm-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className={value === o.id ? 'is-active' : ''} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="adm-empty">
      {Icon && <Icon aria-hidden="true" />}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}
