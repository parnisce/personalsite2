import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TbArrowBackUp, TbCheck, TbWand } from 'react-icons/tb'
import { Busy, Button, CopyButton, Notice, Select } from './lib/ui'

// Grammar, spelling and punctuation checking. The checker (Harper) is a small WebAssembly
// program that runs on the visitor's device, so the text is never sent anywhere.

const DIALECTS = ['American', 'British', 'Australian', 'Canadian', 'Indian']

const KINDS = {
  grammar: ['Agreement', 'Grammar', 'Usage', 'WordOrder', 'Nonstandard', 'Miscellaneous', 'Eggcorn', 'Malapropism'],
  spelling: ['Spelling', 'Typo'],
  punctuation: ['Punctuation', 'Capitalization', 'Formatting', 'BoundaryError', 'Repetition'],
}

const CONFIG = {
  'grammar-checker': {
    kinds: null, // everything
    sample: 'Their are many reasons why this sentance has mistake in it. Me and him goes to the store yesterday, and we buyed three apple.',
    placeholder: 'Type or paste your text here. Mistakes are underlined and fixes appear on the right.',
    noun: 'writing',
  },
  'spell-checker': {
    kinds: KINDS.spelling,
    sample: 'I recieved the pakage yesterday, but it was definately damaged. Please send a replacment as soon as posible.',
    placeholder: 'Type or paste your text here. Misspelled words are underlined.',
    noun: 'spelling',
  },
  'punctuation-checker': {
    kinds: KINDS.punctuation,
    sample: "this is a sentence with no capital letter,and the commas are in the wrong place . it also has has a repeated word",
    placeholder: 'Type or paste your text here. Punctuation and capital-letter mistakes are underlined.',
    noun: 'punctuation and capitalisation',
  },
}

const classify = (kind) => {
  if (KINDS.spelling.includes(kind)) return 'spell'
  if (KINDS.punctuation.includes(kind)) return 'punct'
  if (['Redundancy', 'Readability', 'Style', 'Enhancement', 'WordChoice', 'Regionalism'].includes(kind)) return 'style'
  return 'grammar'
}

const SUGGESTION_KIND = { Replace: 0, Remove: 1, InsertAfter: 2 }

// One shared checker for the page; it is created on first use and keeps its dictionary loaded.
let enginePromise
function getEngine(dialect) {
  enginePromise ??= (async () => {
    const [{ WorkerLinter, Dialect }, { binary }] = await Promise.all([import('harper.js'), import('harper.js/binary')])
    const linter = new WorkerLinter({ binary, dialect: Dialect.American })
    await linter.setup()
    return { linter, Dialect }
  })()
  return enginePromise.then(async (engine) => {
    await engine.linter.setDialect(engine.Dialect[dialect])
    return engine.linter
  })
}

// Harper reports positions in characters (code points); JavaScript strings count UTF-16 units.
// They differ only for text with emoji and other rare characters.
function unitOffsets(text) {
  if (!/[\ud800-\udfff]/.test(text)) return null
  const offsets = [0]
  let n = 0
  for (const ch of text) {
    n += ch.length
    offsets.push(n)
  }
  return offsets
}

function toIssues(text, lints, kinds) {
  const offsets = unitOffsets(text)
  const at = (i) => (offsets ? offsets[Math.min(i, offsets.length - 1)] : i)
  return lints
    .map((lint, index) => {
      const span = lint.span()
      const kind = lint.lint_kind()
      return {
        id: `${span.start}-${span.end}-${kind}-${index}`,
        lint,
        kind,
        group: classify(kind),
        pretty: lint.lint_kind_pretty(),
        message: lint.message(),
        start: at(span.start),
        end: at(span.end),
        problem: lint.get_problem_text(),
        suggestions: lint.suggestions().map((s) => ({ raw: s, text: s.get_replacement_text(), kind: s.kind() })),
      }
    })
    .filter((i) => !kinds || kinds.includes(i.kind))
    .sort((a, b) => a.start - b.start)
}

const describe = (s) => {
  if (s.kind === SUGGESTION_KIND.Remove) return 'Remove'
  if (s.kind === SUGGESTION_KIND.InsertAfter) return `Insert “${s.text}”`
  return s.text === '' ? 'Remove' : s.text
}

// The coloured underlines sit in a layer behind a see-through textarea, so typing stays native.
function Highlights({ text, issues, scrollTop, active }) {
  const parts = []
  let cursor = 0
  issues.forEach((issue) => {
    if (issue.start < cursor || issue.end <= issue.start) return
    if (issue.start > cursor) parts.push(text.slice(cursor, issue.start))
    parts.push(
      <mark key={issue.id} className={`tp-mark is-${issue.group}${active === issue.id ? ' is-active' : ''}`}>
        {text.slice(issue.start, issue.end)}
      </mark>,
    )
    cursor = issue.end
  })
  parts.push(text.slice(cursor))
  return (
    <div className="tp-hl-back" aria-hidden="true" style={{ '--scroll': `${scrollTop}px` }}>
      <div className="tp-hl-inner">
        {parts}
        {'\n '}
      </div>
    </div>
  )
}

export default function WritingTool({ slug }) {
  const config = CONFIG[slug]
  const [text, setText] = useState('')
  const [dialect, setDialect] = useState('American')
  const [issues, setIssues] = useState([])
  const [ignored, setIgnored] = useState(() => new Set())
  const [history, setHistory] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [error, setError] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const [active, setActive] = useState(null)
  const [notice, setNotice] = useState('')
  const area = useRef(null)
  const run = useRef(0)

  // Check the text shortly after the visitor stops typing.
  useEffect(() => {
    const token = ++run.current
    if (!text.trim()) {
      setIssues([])
      return undefined
    }
    const timer = setTimeout(async () => {
      try {
        const linter = await getEngine(dialect)
        const lints = await linter.lint(text, { language: 'plaintext' })
        if (token !== run.current) return
        setIssues(toIssues(text, lints, config.kinds))
        setStatus('ready')
        setError('')
      } catch (e) {
        if (token !== run.current) return
        setStatus('error')
        setError(`The checker could not start: ${e.message}`)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [text, dialect, config.kinds])

  // Warm up the engine as soon as the page opens, so the first check is quick.
  useEffect(() => {
    let live = true
    getEngine('American')
      .then(() => live && setStatus('ready'))
      .catch((e) => {
        if (!live) return
        setStatus('error')
        setError(`The checker could not start: ${e.message}`)
      })
    return () => {
      live = false
    }
  }, [])

  const visible = useMemo(() => issues.filter((i) => !ignored.has(`${i.kind}:${i.problem}`)), [issues, ignored])

  const change = useCallback((next) => {
    setHistory((h) => [...h.slice(-30), text])
    setText(next)
    setNotice('')
  }, [text])

  const apply = async (issue, suggestion) => {
    const linter = await getEngine(dialect)
    change(await linter.applySuggestion(text, issue.lint, suggestion.raw))
  }

  const fixAll = async () => {
    const linter = await getEngine(dialect)
    let next = text
    let count = 0
    let boundary = Infinity
    // From the end of the text backwards, so earlier positions stay valid.
    for (const issue of [...visible].sort((a, b) => b.start - a.start)) {
      if (!issue.suggestions.length || issue.end > boundary) continue
      next = await linter.applySuggestion(next, issue.lint, issue.suggestions[0].raw)
      boundary = issue.start
      count++
    }
    if (count) {
      change(next)
      setNotice(`Applied ${count} fix${count === 1 ? '' : 'es'}. Read through the result to make sure it says what you mean.`)
    }
  }

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h
      setText(h[h.length - 1])
      setNotice('')
      return h.slice(0, -1)
    })
  }

  const jump = (issue) => {
    setActive(issue.id)
    const el = area.current
    el.focus()
    el.setSelectionRange(issue.start, issue.end)
    const line = text.slice(0, issue.start).split('\n').length - 1
    el.scrollTop = Math.max(0, line * 24 - el.clientHeight / 3)
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const fixable = visible.filter((i) => i.suggestions.length).length
  const clean = text.trim() && status === 'ready' && visible.length === 0

  return (
    <div className="tp-stack">
      <div className="tp-workspace tp-writing">
        <div className="tp-panel">
          <div className="tp-row tp-between">
            <Select label="English" value={dialect} onChange={setDialect} options={DIALECTS} />
            <div className="tp-row">
              {!text && (
                <Button variant="ghost" onClick={() => setText(config.sample)}>
                  Try an example
                </Button>
              )}
              <Button variant="ghost" disabled={!history.length} onClick={undo} icon={<TbArrowBackUp aria-hidden="true" />}>
                Undo
              </Button>
            </div>
          </div>
          <div className="tp-hl">
            <Highlights text={text} issues={visible} scrollTop={scrollTop} active={active} />
            <textarea
              ref={area}
              className="tp-hl-text"
              value={text}
              spellCheck="false"
              placeholder={config.placeholder}
              aria-label="Your text"
              onChange={(e) => {
                setHistory((h) => [...h.slice(-30), text])
                setText(e.target.value)
                setNotice('')
              }}
              onScroll={(e) => setScrollTop(e.target.scrollTop)}
              onBlur={() => setActive(null)}
            />
          </div>
          <div className="tp-row tp-between">
            <span className="tp-meta">
              {words} word{words === 1 ? '' : 's'} · {text.length} characters
            </span>
            <div className="tp-row">
              <CopyButton text={text} label="Copy text" />
              {text && (
                <Button variant="ghost" onClick={() => change('')}>
                  Clear
                </Button>
              )}
            </div>
          </div>
          {status === 'loading' && <Busy label="Loading the checker (first time only)…" />}
          <Notice>{error}</Notice>
          <Notice kind="info">{notice}</Notice>
        </div>

        <div className="tp-preview tp-issues" aria-live="polite">
          <div className="tp-row tp-between">
            <h2 className="tp-issues-title">
              {!text.trim() ? 'Suggestions' : clean ? 'All clear' : `${visible.length} suggestion${visible.length === 1 ? '' : 's'}`}
            </h2>
            {fixable > 1 && (
              <Button onClick={fixAll} icon={<TbWand aria-hidden="true" />}>
                Fix all ({fixable})
              </Button>
            )}
          </div>
          {!text.trim() && <p className="tp-hint">Your {config.noun} suggestions will appear here as you type.</p>}
          {clean && (
            <p className="tp-allclear">
              <TbCheck aria-hidden="true" /> No {config.noun} problems found.
            </p>
          )}
          <ul className="tp-issuelist">
            {visible.map((issue) => (
              <li key={issue.id} className={`tp-issue is-${issue.group}${active === issue.id ? ' is-active' : ''}`}>
                <button type="button" className="tp-issue-head" onClick={() => jump(issue)}>
                  <span className="tp-kind">{issue.pretty}</span>
                  <span className="tp-problem">{issue.problem.trim() || '·'}</span>
                </button>
                <p className="tp-issue-msg">{issue.message}</p>
                <div className="tp-row">
                  {issue.suggestions.slice(0, 4).map((s, i) => (
                    <button key={i} type="button" className="tp-fix" onClick={() => apply(issue, s)}>
                      {describe(s)}
                    </button>
                  ))}
                  <button type="button" className="tp-ignore" onClick={() => setIgnored((cur) => new Set(cur).add(`${issue.kind}:${issue.problem}`))}>
                    Ignore
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {ignored.size > 0 && (
            <button type="button" className="tp-copy" onClick={() => setIgnored(new Set())}>
              Show {ignored.size} ignored suggestion{ignored.size === 1 ? '' : 's'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
