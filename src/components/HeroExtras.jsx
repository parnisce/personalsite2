import { useEffect, useState } from 'react'
import { FiHeart } from 'react-icons/fi'
import { getSupabase } from '../lib/supabaseLazy'
import './HeroExtras.css'

// ---------------------------------------------------------------- availability + likes

const LIKED_KEY = 'cb-liked'

const readLiked = () => {
  try {
    return localStorage.getItem(LIKED_KEY) === '1'
  } catch {
    return false
  }
}

// One like per browser. The total comes from a database function, so the public key never needs
// permission to read the table.
function LikeButton() {
  const [count, setCount] = useState(null)
  const [liked, setLiked] = useState(readLiked)

  useEffect(() => {
    let live = true
    getSupabase()
      .then((supabase) => supabase.rpc('get_likes'))
      .then(({ data, error }) => {
        if (live && !error && Number.isFinite(Number(data))) setCount(Number(data))
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  const like = () => {
    if (liked) return
    setLiked(true)
    setCount((c) => (c === null ? c : c + 1))
    try {
      localStorage.setItem(LIKED_KEY, '1')
    } catch {
      // The like still counts for this visit.
    }
    getSupabase()
      .then((supabase) => supabase.from('portfolio_likes').insert({}))
      .then(
        () => {},
        () => {},
      )
  }

  return (
    <button type="button" className={`hero-like${liked ? ' is-liked' : ''}`} aria-pressed={liked} onClick={like}>
      <FiHeart aria-hidden="true" />
      <span>{liked ? 'You liked this portfolio' : 'Like this portfolio'}</span>
      {count !== null && <b aria-label={`${count} likes`}>{count}</b>}
    </button>
  )
}

export function HeroStatus() {
  return (
    <div className="hero-status hero-in">
      <span className="hero-available">
        <i aria-hidden="true" />
        Available for new projects
      </span>
      <LikeButton />
    </div>
  )
}

// ---------------------------------------------------------------- rotating headline

export const ROTATING_LINES = ['I AUTOMATE.', 'I INNOVATE.', 'I BUILD WITH AI.', 'I SCALE SYSTEMS.', 'I OPTIMIZE.', 'I INTEGRATE.']

// The blue headline line: each phrase slides up out of view as the next slides in, then it loops.
export function RotatingLine({ phrases = ROTATING_LINES, reduced = false, interval = 2600 }) {
  const [state, setState] = useState({ index: 0, prev: null })

  useEffect(() => {
    const timer = setInterval(() => setState((s) => ({ index: (s.index + 1) % phrases.length, prev: s.index })), interval)
    return () => clearInterval(timer)
  }, [phrases.length, interval])

  const current = phrases[state.index]
  return (
    <span className={`accent rotating${reduced ? ' is-static' : ''}`} role="text" aria-label={current} aria-live="off">
      {/* The longest phrase holds the width so the line never jumps. */}
      <span className="rotating-sizer" aria-hidden="true">
        {phrases.reduce((a, b) => (b.length > a.length ? b : a), '')}
      </span>
      {state.prev !== null && (
        <span key={`out-${state.prev}-${state.index}`} className="rotating-word is-out" aria-hidden="true">
          {phrases[state.prev]}
        </span>
      )}
      <span key={`in-${state.index}`} className={`rotating-word${state.prev === null ? ' is-first' : ' is-in'}`} aria-hidden="true">
        {current}
      </span>
    </span>
  )
}

// ---------------------------------------------------------------- ticker under the hero

const TICKER_ITEMS = ['Next.js websites', 'GoHighLevel funnels', 'Workflows & automation', 'Conversation AI', 'Lead generation', 'CRM integrations', 'APIs & backends', 'Brand & web design']

export function Ticker() {
  const row = TICKER_ITEMS.map((item) => (
    <li key={item}>
      <span>{item}</span>
      <i aria-hidden="true">✦</i>
    </li>
  ))
  return (
    <div className="ticker" role="region" aria-label="What I do">
      <ul className="ticker-track">{row}</ul>
      <ul className="ticker-track" aria-hidden="true">
        {row}
      </ul>
    </div>
  )
}
