import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  TbArrowLeft,
  TbBlockquote,
  TbBold,
  TbBook,
  TbCode,
  TbDownload,
  TbExternalLink,
  TbH2,
  TbH3,
  TbItalic,
  TbLink,
  TbList,
  TbListNumbers,
  TbMinus,
  TbPlus,
  TbSourceCode,
  TbStrikethrough,
  TbTrash,
} from 'react-icons/tb'
import { ResourceArticle } from '../components/ResourceParts'
import { fetchRepo, parseRepo, parseTags, readingMinutes, shortDate, slugify } from '../lib/resources'
import { supabase } from '../lib/supabase'
import '../ResourcesPage.css'
import { useAdmin } from './ctx'
import { EmptyState } from './ui'

const stamp = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// ---------------------------------------------------------------- list

export function ResourcesList() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    supabase
      .from('resources')
      .select('id,slug,title,summary,published,published_at,updated_at,tags')
      .order('updated_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (!live) return
        if (err) setError(err.message)
        else setItems(data)
      })
    return () => {
      live = false
    }
  }, [])

  return (
    <div className="adm-page">
      <header className="adm-pagehead">
        <div>
          <h1>Resources</h1>
          <p className="adm-sub">
            Write-ups shown on the public Resources page{items ? ` · ${items.filter((r) => r.published).length} published, ${items.filter((r) => !r.published).length} drafts` : ''}
          </p>
        </div>
        <div className="adm-actions">
          <a className="adm-btn is-ghost" href="/resources/" target="_blank" rel="noopener noreferrer">
            <TbExternalLink aria-hidden="true" /> View page
          </a>
          <a className="adm-btn is-light" href="#/resources/new">
            <TbPlus aria-hidden="true" /> New resource
          </a>
        </div>
      </header>

      {error && (
        <p className="adm-banner" role="alert">
          Could not load resources: {error}. Make sure the latest supabase/schema.sql has been run.
        </p>
      )}
      {items && items.length === 0 && (
        <EmptyState icon={TbBook} title="No resources yet" action={<a className="adm-btn is-light" href="#/resources/new">Write the first one</a>}>
          Add a GitHub repo, explain it, and publish it to the Resources page.
        </EmptyState>
      )}
      <ul className="adm-reslist">
        {(items ?? []).map((r) => (
          <li key={r.id}>
            <a href={`#/resources/${r.id}`}>
              <span className={`adm-pubtag${r.published ? ' is-live' : ''}`}>{r.published ? 'Published' : 'Draft'}</span>
              <strong>{r.title}</strong>
              <span className="adm-reslist-sum">{r.summary}</span>
              <small>{r.published ? shortDate(r.published_at) : `Edited ${shortDate(r.updated_at)}`}</small>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------- editor

const BLANK = { title: '', slug: '', github_url: '', github: null, summary: '', tags: '', body: '', published: false, published_at: null }

const toDraft = (row) => ({
  title: row.title,
  slug: row.slug,
  github_url: row.github_url ?? '',
  github: row.github ?? null,
  summary: row.summary ?? '',
  tags: (row.tags ?? []).join(', '),
  body: row.body ?? '',
  published: row.published,
  published_at: row.published_at,
})

const TOOLS = [
  { label: 'Heading 2', Icon: TbH2, line: '## ' },
  { label: 'Heading 3', Icon: TbH3, line: '### ' },
  { label: 'Bold', Icon: TbBold, wrap: ['**', '**', 'bold text'] },
  { label: 'Italic', Icon: TbItalic, wrap: ['*', '*', 'italic text'] },
  { label: 'Strikethrough', Icon: TbStrikethrough, wrap: ['~~', '~~', 'text'] },
  { label: 'Inline code', Icon: TbCode, wrap: ['`', '`', 'code'] },
  { label: 'Link', Icon: TbLink, wrap: ['[', '](https://)', 'link text'] },
  { label: 'Bulleted list', Icon: TbList, line: '- ' },
  { label: 'Numbered list', Icon: TbListNumbers, line: '1. ' },
  { label: 'Quote', Icon: TbBlockquote, line: '> ' },
  { label: 'Code block', Icon: TbSourceCode, wrap: ['\n```\n', '\n```\n', 'code'] },
  { label: 'Divider', Icon: TbMinus, wrap: ['\n\n---\n\n', '', ''] },
]

export function ResourceEditor({ id }) {
  const { toast } = useAdmin()
  const base = useId()
  const isNew = id === 'new'
  const [rowId, setRowId] = useState(isNew ? null : id)
  const [draft, setDraft] = useState(BLANK)
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [status, setStatus] = useState(isNew ? 'ready' : 'loading') // loading | ready | missing
  const [savedAt, setSavedAt] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')
  const body = useRef(null)

  useEffect(() => {
    if (isNew) return undefined
    let live = true
    supabase
      .from('resources')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!live) return
        if (!data) {
          setStatus('missing')
          return
        }
        setDraft(toDraft(data))
        setSavedAt(data.updated_at)
        setStatus('ready')
      })
    return () => {
      live = false
    }
  }, [id, isNew])

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return undefined
    const warn = (e) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const set = (patch) => {
    setDraft((d) => ({ ...d, ...patch }))
    setDirty(true)
    setError('')
  }

  const onTitle = (title) => set(slugTouched ? { title } : { title, slug: slugify(title) })

  const fetchGithub = async () => {
    setFetching(true)
    setError('')
    try {
      const repo = await fetchRepo(draft.github_url)
      const patch = { github: repo, github_url: repo.html_url }
      if (!draft.summary && repo.description) patch.summary = repo.description.slice(0, 160)
      set(patch)
      toast(`Fetched ${repo.full_name}`)
    } catch (e) {
      setError(e.message)
    }
    setFetching(false)
  }

  const apply = (tool) => {
    const el = body.current
    if (!el) return
    const { selectionStart: a, selectionEnd: b, value } = el
    let next
    let cursor
    if (tool.wrap) {
      const [before, after, placeholder] = tool.wrap
      const chosen = value.slice(a, b) || placeholder
      next = value.slice(0, a) + before + chosen + after + value.slice(b)
      cursor = [a + before.length, a + before.length + chosen.length]
    } else {
      const start = value.lastIndexOf('\n', a - 1) + 1
      next = value.slice(0, start) + tool.line + value.slice(start)
      cursor = [a + tool.line.length, b + tool.line.length]
    }
    set({ body: next })
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(cursor[0], cursor[1])
    })
  }

  const save = useCallback(
    async (publish) => {
      const title = draft.title.trim()
      const slug = draft.slug.trim()
      if (!title) return setError('Give the resource a title.')
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return setError('The URL can only use lowercase letters, numbers and hyphens.')
      if (draft.summary.length > 160) return setError('Keep the summary to 160 characters or fewer, so Google shows it in full.')
      const published = publish ?? draft.published
      const now = new Date().toISOString()
      const row = {
        slug,
        title,
        summary: draft.summary.trim(),
        tags: parseTags(draft.tags),
        body: draft.body,
        github_url: draft.github_url.trim() || null,
        github: draft.github,
        published,
        published_at: published ? draft.published_at ?? now : draft.published_at,
        updated_at: now,
      }
      setBusy(true)
      setError('')
      const query = rowId ? supabase.from('resources').update(row).eq('id', rowId) : supabase.from('resources').insert(row)
      const { data, error: err } = await query.select('id').single()
      setBusy(false)
      if (err) {
        setError(err.code === '23505' ? 'Another resource already uses that URL. Change it and save again.' : err.message)
        return
      }
      setDraft((d) => ({ ...d, slug, title, published, published_at: row.published_at }))
      setSavedAt(now)
      setDirty(false)
      toast(publish === true ? 'Published' : publish === false ? 'Moved back to drafts' : 'Saved')
      if (!rowId) {
        setRowId(data.id)
        window.history.replaceState(null, '', `#/resources/${data.id}`)
      }
    },
    [draft, rowId, toast],
  )

  const remove = async () => {
    if (!rowId || !window.confirm(`Delete “${draft.title}”? This cannot be undone.`)) return
    const { error: err } = await supabase.from('resources').delete().eq('id', rowId)
    if (err) return setError(err.message)
    setDirty(false)
    toast('Resource deleted')
    window.location.hash = '#/resources'
  }

  if (status === 'loading') return <div className="adm-page" aria-busy="true" />
  if (status === 'missing') {
    return (
      <div className="adm-page">
        <EmptyState icon={TbBook} title="Resource not found" action={<a className="adm-btn is-light" href="#/resources">Back to resources</a>}>
          It may have been deleted.
        </EmptyState>
      </div>
    )
  }

  const f = (name) => `${base}-${name}`
  const repoValid = Boolean(parseRepo(draft.github_url))
  const preview = { ...draft, tags: parseTags(draft.tags) }

  return (
    <div className="adm-page adm-resed">
      <a href="#/resources" className="adm-back">
        <TbArrowLeft aria-hidden="true" /> Resources
      </a>
      <header className="adm-pagehead">
        <div>
          <h1>{rowId ? 'Edit resource' : 'New resource'}</h1>
          <p className="adm-sub">{draft.title || 'Untitled'}</p>
          <p className="adm-resed-status">
            <span className={`adm-pubtag${draft.published ? ' is-live' : ''}`}>{draft.published ? 'Published' : 'Draft'}</span>
            <small>{dirty ? 'Unsaved changes' : savedAt ? `Last saved ${stamp(savedAt)}` : 'Not saved yet'}</small>
          </p>
        </div>
        <div className="adm-actions">
          {draft.published && rowId && (
            <a className="adm-btn is-ghost" href={`/resources/#/${draft.slug}`} target="_blank" rel="noopener noreferrer">
              View live <TbExternalLink aria-hidden="true" />
            </a>
          )}
          <button type="button" className="adm-btn is-ghost" disabled={busy} onClick={() => save()}>
            Save{draft.published ? '' : ' draft'}
          </button>
          {draft.published ? (
            <button type="button" className="adm-btn is-ghost" disabled={busy} onClick={() => save(false)}>
              Unpublish
            </button>
          ) : (
            <button type="button" className="adm-btn is-primary" disabled={busy} onClick={() => save(true)}>
              Publish
            </button>
          )}
        </div>
      </header>

      {error && (
        <p className="adm-banner" role="alert">
          {error}
        </p>
      )}

      <div className="adm-resed-grid">
        <form className="adm-card-panel adm-resed-form" onSubmit={(e) => e.preventDefault()} noValidate>
          <div className="adm-field">
            <label htmlFor={f('title')}>Title</label>
            <input id={f('title')} value={draft.title} maxLength={200} onChange={(e) => onTitle(e.target.value)} />
          </div>
          <div className="adm-field">
            <label htmlFor={f('slug')}>URL</label>
            <div className="adm-slug">
              <span>/resources/#/</span>
              <input
                id={f('slug')}
                value={draft.slug}
                maxLength={80}
                onChange={(e) => {
                  setSlugTouched(true)
                  set({ slug: e.target.value.toLowerCase() })
                }}
              />
            </div>
            {draft.published && <p className="adm-hint">Changing the URL of a published article breaks links to it.</p>}
          </div>
          <div className="adm-field">
            <label htmlFor={f('repo')}>GitHub repo URL</label>
            <div className="adm-fetchrow">
              <input id={f('repo')} value={draft.github_url} placeholder="https://github.com/owner/repo" onChange={(e) => set({ github_url: e.target.value })} />
              <button type="button" className="adm-btn is-ghost" disabled={!repoValid || fetching} onClick={fetchGithub}>
                <TbDownload aria-hidden="true" /> {fetching ? 'Fetching…' : 'Fetch'}
              </button>
            </div>
            <p className="adm-hint">Fetch pulls the stars, language, licence and last update from GitHub. Fetch again any time to refresh them.</p>
          </div>
          <div className="adm-field">
            <label htmlFor={f('summary')}>
              Summary ({draft.summary.length}/160, used as the Google description)
            </label>
            <textarea id={f('summary')} rows={3} value={draft.summary} aria-invalid={draft.summary.length > 160 ? 'true' : undefined} onChange={(e) => set({ summary: e.target.value })} />
          </div>
          <div className="adm-field">
            <label htmlFor={f('tags')}>Tags (comma separated)</label>
            <input id={f('tags')} value={draft.tags} placeholder="MCP, AI Agents, Claude Code" onChange={(e) => set({ tags: e.target.value })} />
          </div>
          <div className="adm-field">
            <label htmlFor={f('body')}>
              Body (Markdown) · {readingMinutes(draft.body)} min read
            </label>
            <div className="adm-mdbar" role="toolbar" aria-label="Formatting">
              {TOOLS.map((t) => (
                <button key={t.label} type="button" title={t.label} aria-label={t.label} onClick={() => apply(t)}>
                  <t.Icon aria-hidden="true" />
                </button>
              ))}
            </div>
            <textarea ref={body} id={f('body')} className="adm-json adm-mdarea" rows={20} spellCheck value={draft.body} onChange={(e) => set({ body: e.target.value })} />
          </div>
          {rowId && (
            <button type="button" className="adm-btn is-danger" onClick={remove}>
              <TbTrash aria-hidden="true" /> Delete resource
            </button>
          )}
        </form>

        <section className="adm-resed-preview" aria-label="Live preview">
          <p className="adm-eyebrow">Live preview</p>
          <div className="adm-card-panel">
            <ResourceArticle resource={preview} />
          </div>
        </section>
      </div>
    </div>
  )
}
