import { useEffect, useState } from 'react'
import { PROJECTS, STATS, TESTIMONIALS } from '../data'
import { CONTENT_SHAPES } from '../lib/content'
import { supabase } from '../lib/supabase'
import { useAdmin } from './ctx'

// The built-in copy, captured before any saved content replaces it.
const BUILT_IN = JSON.parse(JSON.stringify({ projects: PROJECTS, testimonials: TESTIMONIALS, stats: STATS }))

const SECTIONS = [
  { key: 'projects', title: 'Projects', hint: 'Cards in the Work section. Each needs a title, url and description; tags is a list of words and hue is a number 0 to 360.' },
  { key: 'testimonials', title: 'Testimonials', hint: 'Each needs a quote and a name; role is optional.' },
  { key: 'stats', title: 'Stats', hint: 'The numbers under the hero. Each needs a value (number), suffix and label.' },
]

function Editor({ section }) {
  const { toast } = useAdmin()
  const [text, setText] = useState(() => JSON.stringify(BUILT_IN[section.key], null, 2))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(null)

  useEffect(() => {
    let live = true
    supabase
      .from('site_content')
      .select('data,updated_at')
      .eq('key', section.key)
      .maybeSingle()
      .then(({ data }) => {
        if (!live || !data) return
        setText(JSON.stringify(data.data, null, 2))
        setSaved(data.updated_at)
      })
    return () => {
      live = false
    }
  }, [section.key])

  const save = async () => {
    let value
    try {
      value = JSON.parse(text)
    } catch (e) {
      setError(`That is not valid JSON: ${e.message}`)
      return
    }
    if (!CONTENT_SHAPES[section.key].valid(value)) {
      setError(section.hint)
      return
    }
    setBusy(true)
    setError('')
    const updatedAt = new Date().toISOString()
    const { error: err } = await supabase.from('site_content').upsert({ key: section.key, data: value, updated_at: updatedAt })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setSaved(updatedAt)
    toast(`${section.title} saved. Reload the site to see it.`)
  }

  return (
    <section className="adm-card-panel adm-content">
      <h2>{section.title}</h2>
      <p className="adm-hint">{section.hint}</p>
      <textarea
        className="adm-json"
        rows={14}
        spellCheck={false}
        value={text}
        aria-label={`${section.title} as JSON`}
        aria-invalid={error ? 'true' : undefined}
        onChange={(e) => {
          setText(e.target.value)
          setError('')
        }}
      />
      {error && (
        <p className="adm-error" role="alert">
          {error}
        </p>
      )}
      <div className="adm-actions">
        <button type="button" className="adm-btn is-primary" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save to site'}
        </button>
        <button type="button" className="adm-btn is-ghost" onClick={() => setText(JSON.stringify(BUILT_IN[section.key], null, 2))}>
          Reset to built-in copy
        </button>
        {saved && <small className="adm-muted">Saved online {new Date(saved).toLocaleString('en-GB')}</small>}
      </div>
    </section>
  )
}

export default function ContentPage() {
  return (
    <div className="adm-page">
      <header className="adm-pagehead">
        <div>
          <h1>Site content</h1>
          <p className="adm-sub">Edit what the public website shows. Changes go live as soon as you save.</p>
        </div>
      </header>
      {SECTIONS.map((s) => (
        <Editor key={s.key} section={s} />
      ))}
    </div>
  )
}
