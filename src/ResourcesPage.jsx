import { useEffect, useState } from 'react'
import { TbArrowLeft } from 'react-icons/tb'
import { ResourceArticle, ResourceCard } from './components/ResourceParts'
import { Footer, Header } from './components/SiteChrome'
import { getPublished, listPublished } from './lib/resources'
import './App.css'
import './ResourcesPage.css'

const TITLE = 'Resources | Cyryl Bitangcol'

const slugFromHash = () => decodeURIComponent(window.location.hash.replace(/^#\/?/, '').split('/')[0] ?? '')

function useSlug() {
  const [slug, setSlug] = useState(slugFromHash)
  useEffect(() => {
    const onHash = () => {
      setSlug(slugFromHash())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return slug
}

// 'loading' | 'ready' | 'error'
function useAsync(load, deps) {
  const [state, setState] = useState({ status: 'loading', data: null })
  useEffect(() => {
    let live = true
    load()
      .then((data) => live && setState({ status: 'ready', data }))
      .catch(() => live && setState({ status: 'error', data: null }))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

function List() {
  const { status, data } = useAsync(listPublished, [])
  const [tag, setTag] = useState('')
  useEffect(() => {
    document.title = TITLE
  }, [])
  const tags = [...new Set((data ?? []).flatMap((r) => r.tags))]
  const shown = (data ?? []).filter((r) => !tag || r.tags.includes(tag))

  return (
    <>
      <section className="res-hero">
        <p className="eyebrow">Resources</p>
        <h1>
          Fresh repos.
          <br />
          <span className="accent">Explained properly.</span>
        </h1>
        <p className="lead">New GitHub projects and dev tools I have tried, with what they do, how to install them and where they fit in a real build.</p>
      </section>

      {tags.length > 1 && (
        <div className="res-filters" role="group" aria-label="Filter by topic">
          {['', ...tags].map((t) => (
            <button key={t || 'all'} type="button" className={tag === t ? 'is-active' : ''} aria-pressed={tag === t} onClick={() => setTag(t)}>
              {t || 'All'}
            </button>
          ))}
        </div>
      )}

      {status === 'loading' && <p className="res-note" role="status">Loading resources…</p>}
      {status === 'error' && <p className="res-note">Resources could not be loaded right now. Please try again in a moment.</p>}
      {status === 'ready' && shown.length === 0 && <p className="res-note">{data.length ? 'Nothing under that topic yet.' : 'The first write-ups are on their way.'}</p>}
      <div className="res-grid">
        {shown.map((r) => (
          <ResourceCard key={r.id} resource={r} />
        ))}
      </div>
    </>
  )
}

function Article({ slug }) {
  const { status, data } = useAsync(() => getPublished(slug), [slug])
  useEffect(() => {
    document.title = data ? `${data.title} | Cyryl Bitangcol` : TITLE
    if (data) {
      const meta = document.querySelector('meta[name="description"]')
      meta?.setAttribute('content', data.summary || data.title)
    }
  }, [data])

  return (
    <>
      <a href="#/" className="res-back">
        <TbArrowLeft aria-hidden="true" /> All resources
      </a>
      {status === 'loading' && <p className="res-note" role="status">Loading…</p>}
      {status === 'error' && <p className="res-note">This resource could not be loaded right now.</p>}
      {status === 'ready' && !data && (
        <p className="res-note">
          We could not find that resource. <a href="#/">See everything</a>
        </p>
      )}
      {data && <ResourceArticle resource={data} />}
    </>
  )
}

export default function ResourcesPage() {
  const slug = useSlug()
  return (
    <div className="res-page">
      <Header active="resources" onHome={false} />
      <main className="shell res-main">{slug ? <Article key={slug} slug={slug} /> : <List />}</main>
      <Footer onHome={false} />
    </div>
  )
}
