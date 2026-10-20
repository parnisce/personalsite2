import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  TbArrowLeft,
  TbArrowsExchange,
  TbArrowUpRight,
  TbFileTypePdf,
  TbPalette,
  TbVideo,
  TbPhoto,
  TbSearch,
  TbShieldLock,
  TbX,
} from 'react-icons/tb'
import { Footer, Header } from './components/SiteChrome'
import { findTool, TOOL_CATEGORIES, TOOLS } from './tools'
import { toolScreen } from './tools/registry'
import './App.css'
import './ToolsPage.css'
import './tools/ToolPages.css'

const CATEGORY_ICONS = {
  Image: TbPhoto,
  Converters: TbArrowsExchange,
  PDF: TbFileTypePdf,
  Colour: TbPalette,
  'Video & audio': TbVideo,
}

const COUNTS = TOOLS.reduce((acc, t) => ({ ...acc, [t.category]: (acc[t.category] ?? 0) + 1 }), {})
const DIRECTORY_TITLE = 'Free Online Image & Colour Tools | Cyryl Bitangcol'
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Tools live at /tools/#/<slug>, so they work on any static host without server rewrites.
const slugFromHash = () => decodeURIComponent(window.location.hash.replace(/^#\/?/, '')).replace(/\/$/, '')

function useRoute() {
  const [slug, setSlug] = useState(slugFromHash)
  useEffect(() => {
    const onChange = () => {
      setSlug(slugFromHash())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return slug
}

// If one tool crashes (a damaged file, an unsupported browser feature), the rest of the page
// still works and the visitor gets a way back.
class ToolBoundary extends Component {
  state = { failed: null }
  static getDerivedStateFromError(error) {
    return { failed: error }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="tp-notice is-error" role="alert">
        Something went wrong in this tool: {this.state.failed.message}. Reload the page and try again, or pick another tool.
      </div>
    )
  }
}

function ToolCard({ tool }) {
  const Icon = CATEGORY_ICONS[tool.category]
  return (
    <a href={tool.href} className="tool-card">
      <span className="tool-card-top">
        <span className="tool-card-icon">
          <Icon aria-hidden="true" />
        </span>
        <span className="tool-card-cat">{tool.category}</span>
        <TbArrowUpRight className="tool-card-arrow" aria-hidden="true" />
      </span>
      <h2>{tool.name}</h2>
      <p>{tool.description}</p>
    </a>
  )
}

function Directory() {
  const root = useRef(null)
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')

  useEffect(() => {
    document.title = DIRECTORY_TITLE
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return TOOLS.filter(
      (t) =>
        (category === 'All' || t.category === category) &&
        (!q || `${t.name} ${t.description} ${t.category}`.toLowerCase().includes(q)),
    )
  }, [category, query])

  // Intro once, then a quick stagger whenever the filter or search changes the grid.
  useGSAP(
    () => {
      if (reduced()) return
      gsap.from('.tools-hero > *', { y: 28, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08 })
    },
    { scope: root },
  )
  useGSAP(
    () => {
      if (reduced()) return
      gsap.from('.tool-card', {
        y: 18,
        opacity: 0,
        duration: 0.5,
        ease: 'power2.out',
        stagger: { each: 0.02, amount: 0.4 },
        overwrite: true,
      })
    },
    { scope: root, dependencies: [category, query], revertOnUpdate: true },
  )

  return (
    <div ref={root}>
      <section className="tools-hero">
        <p className="eyebrow">Free Tools</p>
        <h1 className="tools-title">
          Free tools.
          <br />
          <span className="accent">No uploads, no sign&#8209;up.</span>
        </h1>
        <p className="lead">
          Resize, convert and edit images, work with PDFs and colour, and transcribe video and audio, all inside your browser.
        </p>
        <p className="privacy-note">
          <TbShieldLock /> Files are processed on your device and never uploaded.
        </p>
      </section>

      <div className="tools-controls">
        <div className="tool-filters" role="group" aria-label="Filter tools by category">
          {['All', ...TOOL_CATEGORIES].map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              className={category === c ? 'is-active' : ''}
              onClick={() => setCategory(c)}
            >
              {c}
              <span>{c === 'All' ? TOOLS.length : COUNTS[c]}</span>
            </button>
          ))}
        </div>
        <label className="tool-search">
          <TbSearch aria-hidden="true" />
          <input
            type="search"
            placeholder="Search tools"
            aria-label="Search tools"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery('')}>
              <TbX />
            </button>
          )}
        </label>
      </div>

      <p className="tools-count" aria-live="polite">
        {visible.length} {visible.length === 1 ? 'tool' : 'tools'}
      </p>

      {visible.length ? (
        <div className="tool-grid">
          {visible.map((t) => (
            <ToolCard key={t.slug} tool={t} />
          ))}
        </div>
      ) : (
        <div className="tools-empty">
          <p>
            No tools match &ldquo;{query}&rdquo;
            {category !== 'All' && ` in ${category}`}.
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setQuery('')
              setCategory('All')
            }}
          >
            Show all tools
          </button>
        </div>
      )}
    </div>
  )
}

function ToolView({ tool }) {
  const screen = toolScreen(tool)
  const related = TOOLS.filter((t) => t.category === tool.category && t.slug !== tool.slug)
    .slice(0, 6)

  useEffect(() => {
    document.title = `${tool.name} | Free Online Tool | Cyryl Bitangcol`
    return () => {
      document.title = DIRECTORY_TITLE
    }
  }, [tool])

  return (
    <div className="tool-view">
      <a href="#/" className="tool-back">
        <TbArrowLeft aria-hidden="true" /> All free tools
      </a>
      <header className="tool-head">
        <p className="eyebrow">{tool.category}</p>
        <h1 className="tool-title">{tool.name}</h1>
        <p className="lead">{tool.description}</p>
        <p className="privacy-note">
          <TbShieldLock /> Files are processed on your device and never uploaded.
        </p>
        {tool.note && <p className="tool-note">{tool.note}</p>}
      </header>
      <ToolBoundary key={tool.slug}>
        <Suspense fallback={<p className="tp-busy" role="status"><span className="tp-spinner" aria-hidden="true" /> Loading tool…</p>}>
          {screen ? <screen.Component {...screen.props} /> : <p className="tp-notice is-error">This tool is not available yet.</p>}
        </Suspense>
      </ToolBoundary>
      {related.length > 0 && (
        <section className="tool-related" aria-labelledby="related-title">
          <h2 id="related-title">More {tool.category.toLowerCase()} tools</h2>
          <div className="tool-grid">
            {related.map((t) => (
              <ToolCard key={t.slug} tool={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default function ToolsPage() {
  const slug = useRoute()
  const tool = slug ? findTool(slug) : null
  return (
    <div className="tools-page">
      <Header active="tools" onHome={false} />
      <main className="shell tools-main">
        {slug && !tool ? (
          <div className="tools-empty">
            <p>We couldn&apos;t find a tool called &ldquo;{slug}&rdquo;.</p>
            <a href="/tools/" className="btn btn-ghost btn-sm">
              See all free tools
            </a>
          </div>
        ) : tool ? (
          <ToolView tool={tool} />
        ) : (
          <Directory />
        )}
      </main>
      <Footer onHome={false} />
    </div>
  )
}
