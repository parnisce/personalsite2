import { useId, useState } from 'react'
import { TbPlus, TbTrash, TbX } from 'react-icons/tb'
import { useAdmin } from './ctx'
import Modal from './Modal'
import { PRIORITIES, STATUSES, allLabels, formatDuration, formatWhen, makeTask, taskSeconds, uid } from './store'

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// Create or edit one task. `task` is null for a new task; `defaults` seeds its first values.
export default function TaskModal({ task, defaults, onSave, onDelete, onClose }) {
  const { state, dispatch, now } = useAdmin()
  const isNew = !task
  const [initial] = useState(() => task ?? makeTask(defaults))
  const [draft, setDraft] = useState(initial)
  const [labelText, setLabelText] = useState('')
  const [subtaskText, setSubtaskText] = useState('')
  const [logMinutes, setLogMinutes] = useState('')
  const [error, setError] = useState('')
  const idBase = useId()
  const id = (n) => `${idBase}-${n}`
  const dirty = !same(draft, initial) || labelText.trim() !== '' || subtaskText.trim() !== ''
  const labels = allLabels(state.tasks)

  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }))

  const addLabel = (raw) => {
    const value = raw.trim().toLowerCase().slice(0, 24)
    if (!value) return
    setDraft((d) => (d.labels.includes(value) || d.labels.length >= 8 ? d : { ...d, labels: [...d.labels, value] }))
    setLabelText('')
  }

  const addSubtask = () => {
    const text = subtaskText.trim()
    if (!text) return
    setDraft((d) => ({ ...d, subtasks: [...d.subtasks, { id: uid(), text: text.slice(0, 200), done: false }] }))
    setSubtaskText('')
  }

  const submit = (e) => {
    e.preventDefault()
    if (!draft.title.trim()) {
      setError('Give the task a title.')
      document.getElementById(id('title'))?.focus()
      return
    }
    // Anything typed but not yet added is kept rather than lost.
    let next = draft
    const pendingLabel = labelText.trim().toLowerCase().slice(0, 24)
    if (pendingLabel && !next.labels.includes(pendingLabel) && next.labels.length < 8) next = { ...next, labels: [...next.labels, pendingLabel] }
    if (subtaskText.trim()) next = { ...next, subtasks: [...next.subtasks, { id: uid(), text: subtaskText.trim().slice(0, 200), done: false }] }
    onSave({ ...next, projectId: next.projectId || null, estimate: Number(next.estimate) || 0 }, isNew)
  }

  const logTime = () => {
    const minutes = Number(logMinutes)
    if (!task || !(minutes > 0)) return
    dispatch({ type: 'ADD_ENTRY', taskId: task.id, seconds: minutes * 60 })
    setLogMinutes('')
  }

  const history = isNew ? [] : state.activity.filter((a) => a.taskId === task.id).slice(0, 6)
  const spent = isNew ? 0 : taskSeconds(state, task, now)

  return (
    <Modal
      title={isNew ? 'New task' : 'Edit task'}
      dirty={dirty}
      onClose={onClose}
      onSubmit={submit}
      footer={({ requestClose }) => (
        <>
          {!isNew && (
            <button type="button" className="adm-btn is-danger" onClick={() => onDelete(task)}>
              <TbTrash aria-hidden="true" /> Delete
            </button>
          )}
          <span className="adm-spacer" />
          <button type="button" className="adm-btn is-ghost" onClick={requestClose}>
            Cancel
          </button>
          <button type="submit" className="adm-btn is-primary">
            {isNew ? 'Create task' : 'Save changes'}
          </button>
        </>
      )}
    >
      <div className="adm-field">
        <label htmlFor={id('title')}>Title</label>
        <input
          id={id('title')}
          data-autofocus
          value={draft.title}
          onChange={(e) => {
            setDraft((d) => ({ ...d, title: e.target.value }))
            setError('')
          }}
          maxLength={200}
          placeholder="What needs doing?"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? id('error') : undefined}
        />
        {error && (
          <p className="adm-error" id={id('error')} role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="adm-field">
        <label htmlFor={id('desc')}>Notes</label>
        <textarea id={id('desc')} rows={3} value={draft.description} onChange={set('description')} maxLength={5000} placeholder="Details, links, what done looks like…" />
      </div>

      <div className="adm-grid">
        <div className="adm-field">
          <label htmlFor={id('project')}>Project</label>
          <select id={id('project')} value={draft.projectId ?? ''} onChange={set('projectId')}>
            <option value="">No project (quick task)</option>
            {state.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="adm-field">
          <label htmlFor={id('status')}>Status</label>
          <select id={id('status')} value={draft.status} onChange={set('status')}>
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="adm-field">
          <label htmlFor={id('priority')}>Priority</label>
          <select id={id('priority')} value={draft.priority} onChange={set('priority')}>
            {PRIORITIES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="adm-field">
          <label htmlFor={id('due')}>Due date</label>
          <input id={id('due')} type="date" value={draft.dueDate} onChange={set('dueDate')} />
        </div>
        <div className="adm-field">
          <label htmlFor={id('estimate')}>Estimate (minutes)</label>
          <input id={id('estimate')} type="number" min="0" max="99999" step="5" value={draft.estimate || ''} onChange={set('estimate')} placeholder="Optional" />
          {Number(draft.estimate) > 0 && <span className="adm-hint">{formatDuration(Number(draft.estimate) * 60)}</span>}
        </div>
        {!isNew && (
          <div className="adm-field">
            <label htmlFor={id('log')}>Log time</label>
            <div className="adm-addrow">
              <input
                id={id('log')}
                type="number"
                min="1"
                max="1440"
                value={logMinutes}
                placeholder="Minutes"
                onChange={(e) => setLogMinutes(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    logTime()
                  }
                }}
              />
              <button type="button" className="adm-btn is-ghost" onClick={logTime} disabled={!(Number(logMinutes) > 0)}>
                Add
              </button>
            </div>
            <span className="adm-hint">{formatDuration(spent)} logged so far</span>
          </div>
        )}
      </div>

      <div className="adm-field">
        <label htmlFor={id('labels')}>Labels</label>
        <div className="adm-chipbox">
          {draft.labels.map((l) => (
            <span key={l} className="adm-chip is-label is-editable">
              {l}
              <button type="button" aria-label={`Remove label ${l}`} onClick={() => setDraft((d) => ({ ...d, labels: d.labels.filter((x) => x !== l) }))}>
                <TbX aria-hidden="true" />
              </button>
            </span>
          ))}
          <input
            id={id('labels')}
            list={id('label-list')}
            value={labelText}
            maxLength={24}
            placeholder={draft.labels.length ? 'Add another…' : 'Type a label, press Enter'}
            onChange={(e) => setLabelText(e.target.value.replace(',', ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addLabel(labelText)
              } else if (e.key === 'Backspace' && !labelText && draft.labels.length) {
                setDraft((d) => ({ ...d, labels: d.labels.slice(0, -1) }))
              }
            }}
            onBlur={() => addLabel(labelText)}
          />
          <datalist id={id('label-list')}>
            {labels
              .filter((l) => !draft.labels.includes(l))
              .map((l) => (
                <option key={l} value={l} />
              ))}
          </datalist>
        </div>
      </div>

      <fieldset className="adm-field adm-subtasks">
        <legend>
          Checklist
          {draft.subtasks.length > 0 && (
            <span>
              {draft.subtasks.filter((s) => s.done).length} of {draft.subtasks.length} done
            </span>
          )}
        </legend>
        <ul>
          {draft.subtasks.map((s) => (
            <li key={s.id}>
              <label>
                <input
                  type="checkbox"
                  checked={s.done}
                  onChange={() => setDraft((d) => ({ ...d, subtasks: d.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) }))}
                />
                <span className={s.done ? 'is-done' : ''}>{s.text}</span>
              </label>
              <button type="button" className="adm-icon-btn" aria-label={`Remove ${s.text}`} onClick={() => setDraft((d) => ({ ...d, subtasks: d.subtasks.filter((x) => x.id !== s.id) }))}>
                <TbTrash aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <div className="adm-addrow">
          <input
            value={subtaskText}
            maxLength={200}
            placeholder="Add a step"
            aria-label="New checklist step"
            onChange={(e) => setSubtaskText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addSubtask()
              }
            }}
          />
          <button type="button" className="adm-btn is-ghost" onClick={addSubtask} disabled={!subtaskText.trim()}>
            <TbPlus aria-hidden="true" /> Add
          </button>
        </div>
      </fieldset>

      {history.length > 0 && (
        <div className="adm-history">
          <h3>Recent activity</h3>
          <ul>
            {history.map((a) => (
              <li key={a.id}>
                <span>{a.text}</span>
                <time dateTime={a.at}>{formatWhen(a.at)}</time>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}
