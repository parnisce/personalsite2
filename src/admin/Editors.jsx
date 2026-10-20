import { useId, useState } from 'react'
import { TbPlus, TbTrash } from 'react-icons/tb'
import { useAdmin } from './ctx'
import Modal from './Modal'
import { CATEGORY_COLORS, DAY_LABELS, DAY_NAMES, makeProject, makeRoutine, uid } from './store'

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function CategorySelect({ id, value, onChange }) {
  const { state } = useAdmin()
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {state.categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  )
}

// ---------------------------------------------------------------- project

export function ProjectModal({ project, defaults, onSave, onDelete, onClose }) {
  const { state } = useAdmin()
  const isNew = !project
  const [initial] = useState(() => project ?? makeProject({ categoryId: state.categories[0].id, ...defaults }))
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState('')
  const base = useId()
  const id = (n) => `${base}-${n}`
  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }))

  const submit = (e) => {
    e.preventDefault()
    if (!draft.name.trim()) {
      setError('Give the project a name.')
      document.getElementById(id('name'))?.focus()
      return
    }
    onSave({ ...draft, name: draft.name.trim() }, isNew)
  }

  return (
    <Modal
      title={isNew ? 'New project' : 'Edit project'}
      size="sm"
      dirty={!same(draft, initial)}
      onClose={onClose}
      onSubmit={submit}
      footer={({ requestClose }) => (
        <>
          {!isNew && (
            <button type="button" className="adm-btn is-danger" onClick={() => onDelete(project)}>
              <TbTrash aria-hidden="true" /> Delete
            </button>
          )}
          <span className="adm-spacer" />
          <button type="button" className="adm-btn is-ghost" onClick={requestClose}>
            Cancel
          </button>
          <button type="submit" className="adm-btn is-primary">
            {isNew ? 'Create project' : 'Save changes'}
          </button>
        </>
      )}
    >
      <div className="adm-field">
        <label htmlFor={id('name')}>Name</label>
        <input
          id={id('name')}
          data-autofocus
          value={draft.name}
          maxLength={120}
          placeholder="e.g. Client website"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? id('error') : undefined}
          onChange={(e) => {
            setDraft((d) => ({ ...d, name: e.target.value }))
            setError('')
          }}
        />
        {error && (
          <p className="adm-error" id={id('error')} role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="adm-grid">
        <div className="adm-field">
          <label htmlFor={id('cat')}>Category</label>
          <CategorySelect id={id('cat')} value={draft.categoryId} onChange={(v) => setDraft((d) => ({ ...d, categoryId: v }))} />
        </div>
        <div className="adm-field">
          <label htmlFor={id('due')}>Due date</label>
          <input id={id('due')} type="date" value={draft.dueDate} onChange={set('dueDate')} />
        </div>
      </div>
      <div className="adm-field">
        <label htmlFor={id('desc')}>Notes</label>
        <textarea id={id('desc')} rows={3} value={draft.description} onChange={set('description')} maxLength={2000} placeholder="What is this project about?" />
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- categories

export function CategoriesModal({ onSave, onClose }) {
  const { state } = useAdmin()
  const [initial] = useState(() => state.categories.map((c) => ({ ...c })))
  const [rows, setRows] = useState(initial)
  const [error, setError] = useState('')

  const update = (rowId, patch) => setRows((r) => r.map((c) => (c.id === rowId ? { ...c, ...patch } : c)))

  const submit = (e) => {
    e.preventDefault()
    const clean = rows.map((c) => ({ ...c, name: c.name.trim() })).filter((c) => c.name)
    if (!clean.length) {
      setError('Keep at least one category.')
      return
    }
    onSave(clean)
  }

  return (
    <Modal
      title="Edit categories"
      size="sm"
      dirty={!same(rows, initial)}
      onClose={onClose}
      onSubmit={submit}
      footer={({ requestClose }) => (
        <>
          <button type="button" className="adm-btn is-ghost" onClick={() => setRows((r) => [...r, { id: uid(), name: '', color: CATEGORY_COLORS[r.length % CATEGORY_COLORS.length] }])} disabled={rows.length >= 12}>
            <TbPlus aria-hidden="true" /> Add
          </button>
          <span className="adm-spacer" />
          <button type="button" className="adm-btn is-ghost" onClick={requestClose}>
            Cancel
          </button>
          <button type="submit" className="adm-btn is-primary">
            Save
          </button>
        </>
      )}
    >
      <p className="adm-hint">Categories group your projects and routines. Deleting one moves its projects to the first category.</p>
      <ul className="adm-catlist">
        {rows.map((c, i) => (
          <li key={c.id}>
            <label className="adm-colorpick" title="Change colour">
              <input type="color" value={c.color} aria-label={`Colour for ${c.name || 'new category'}`} onChange={(e) => update(c.id, { color: e.target.value })} />
              <i style={{ background: c.color }} />
            </label>
            <input
              value={c.name}
              maxLength={40}
              placeholder="Category name"
              aria-label={`Name of category ${i + 1}`}
              data-autofocus={i === rows.length - 1 && !c.name ? '' : undefined}
              onChange={(e) => update(c.id, { name: e.target.value })}
            />
            <button type="button" className="adm-icon-btn" aria-label={`Delete ${c.name || 'category'}`} onClick={() => setRows((r) => r.filter((x) => x.id !== c.id))} disabled={rows.length <= 1}>
              <TbTrash aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p className="adm-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------- routine

export function RoutineModal({ routine, onSave, onDelete, onClose }) {
  const { state } = useAdmin()
  const isNew = !routine
  const [initial] = useState(() => routine ?? makeRoutine({ categoryId: state.categories[0].id }))
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState('')
  const base = useId()
  const id = (n) => `${base}-${n}`

  const toggleDay = (d) => setDraft((r) => ({ ...r, days: r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d].sort() }))

  const submit = (e) => {
    e.preventDefault()
    if (!draft.name.trim()) {
      setError('Give the routine a name.')
      document.getElementById(id('name'))?.focus()
      return
    }
    if (!draft.days.length) {
      setError('Pick at least one day.')
      return
    }
    onSave({ ...draft, name: draft.name.trim() }, isNew)
  }

  return (
    <Modal
      title={isNew ? 'New routine' : 'Edit routine'}
      size="sm"
      dirty={!same(draft, initial)}
      onClose={onClose}
      onSubmit={submit}
      footer={({ requestClose }) => (
        <>
          {!isNew && (
            <button type="button" className="adm-btn is-danger" onClick={() => onDelete(routine)}>
              <TbTrash aria-hidden="true" /> Delete
            </button>
          )}
          <span className="adm-spacer" />
          <button type="button" className="adm-btn is-ghost" onClick={requestClose}>
            Cancel
          </button>
          <button type="submit" className="adm-btn is-primary">
            {isNew ? 'Create routine' : 'Save changes'}
          </button>
        </>
      )}
    >
      <div className="adm-field">
        <label htmlFor={id('name')}>Name</label>
        <input id={id('name')} data-autofocus value={draft.name} maxLength={120} placeholder="e.g. Review the week" aria-invalid={error && !draft.name.trim() ? 'true' : undefined} onChange={(e) => {
          setDraft((r) => ({ ...r, name: e.target.value }))
          setError('')
        }} />
      </div>
      <div className="adm-field">
        <label htmlFor={id('cat')}>Category</label>
        <CategorySelect id={id('cat')} value={draft.categoryId} onChange={(v) => setDraft((r) => ({ ...r, categoryId: v }))} />
      </div>
      <fieldset className="adm-field">
        <legend>Repeats on</legend>
        <div className="adm-daypick">
          {DAY_LABELS.map((label, d) => (
            <button key={d} type="button" className={draft.days.includes(d) ? 'is-active' : ''} aria-pressed={draft.days.includes(d)} aria-label={DAY_NAMES[d]} onClick={() => toggleDay(d)}>
              {label}
            </button>
          ))}
        </div>
        <div className="adm-row">
          <button type="button" className="adm-link" onClick={() => setDraft((r) => ({ ...r, days: [0, 1, 2, 3, 4] }))}>
            Weekdays
          </button>
          <button type="button" className="adm-link" onClick={() => setDraft((r) => ({ ...r, days: [0, 1, 2, 3, 4, 5, 6] }))}>
            Every day
          </button>
        </div>
      </fieldset>
      {error && (
        <p className="adm-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  )
}
