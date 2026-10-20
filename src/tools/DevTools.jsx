import { useMemo, useState } from 'react'
import { TbDownload } from 'react-icons/tb'
import { downloadBlob, formatBytes } from './lib/image'
import { Busy, Button, CopyButton, Field, FileDrop, Notice, NumberInput, Select, Toggle, useObjectUrl } from './lib/ui'

// ---------------------------------------------------------------- Image -> Base64

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('This file could not be read.'))
    reader.readAsDataURL(file)
  })

export function ImageToBase64() {
  const [file, setFile] = useState(null)
  const [dataUrl, setDataUrl] = useState('')
  const [view, setView] = useState('uri')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onFiles = async ([f]) => {
    setLoading(true)
    setError('')
    try {
      setDataUrl(await readAsDataUrl(f))
      setFile(f)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const base64 = dataUrl.split(',')[1] ?? ''
  const outputs = {
    uri: dataUrl,
    base64,
    html: `<img src="${dataUrl}" alt="" />`,
    css: `background-image: url("${dataUrl}");`,
  }
  const text = outputs[view]
  const shown = text.length > 60000 ? `${text.slice(0, 60000)}\n… (preview shortened; Copy gives the full text)` : text

  return (
    <div className="tp-stack">
      <FileDrop accept="image/*,.svg,.ico,.heic,.tif,.tiff" onFiles={onFiles} compact={!!file} hint="The image is encoded as-is, with no changes to its quality." />
      {loading && <Busy label="Encoding…" />}
      <Notice>{error}</Notice>
      {file && (
        <div className="tp-workspace">
          <div className="tp-panel">
            <Select
              label="Output"
              value={view}
              onChange={setView}
              options={[
                { value: 'uri', label: 'Data URI (data:image/…;base64,…)' },
                { value: 'base64', label: 'Base64 string only' },
                { value: 'html', label: 'HTML <img> tag' },
                { value: 'css', label: 'CSS background-image' },
              ]}
            />
            <dl className="tp-stats">
              <div>
                <dt>File</dt>
                <dd>{formatBytes(file.size)}</dd>
              </div>
              <div>
                <dt>Encoded</dt>
                <dd>{formatBytes(text.length)}</dd>
              </div>
            </dl>
            <CopyButton text={text} label="Copy to clipboard" />
            {file.size > 100 * 1024 && <Notice kind="info">Base64 adds about a third to the size. It suits small icons and logos best.</Notice>}
          </div>
          <div className="tp-preview">
            <img className="tp-canvas tp-small" src={dataUrl} alt="Encoded image preview" />
            <textarea className="tp-textarea tp-mono" readOnly value={shown} rows={10} aria-label="Encoded result" onFocus={(e) => e.target.select()} />
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Base64 -> Image

const SIGNATURES = [
  ['image/png', [0x89, 0x50, 0x4e, 0x47], 'png'],
  ['image/jpeg', [0xff, 0xd8, 0xff], 'jpg'],
  ['image/gif', [0x47, 0x49, 0x46, 0x38], 'gif'],
  ['image/bmp', [0x42, 0x4d], 'bmp'],
  ['image/x-icon', [0x00, 0x00, 0x01, 0x00], 'ico'],
]

function decodeBase64(input) {
  let text = input.trim()
  let mime = null
  const m = text.match(/^data:([^;,]+)?(;[^,]*)?,/i)
  if (m) {
    mime = m[1] ?? null
    text = text.slice(m[0].length)
    if (!/;base64/i.test(m[2] ?? '')) {
      // A percent-encoded (non-base64) data URI, most often SVG.
      const raw = decodeURIComponent(text)
      return { bytes: new TextEncoder().encode(raw), mime: mime ?? 'image/svg+xml', ext: 'svg' }
    }
  }
  text = text.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  if (!text) throw new Error('Paste a Base64 string or a data URI above.')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw new Error('This text contains characters that are not valid Base64.')
  const bin = atob(text + '='.repeat((4 - (text.length % 4)) % 4))
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  let ext = null
  for (const [type, sig, e] of SIGNATURES) {
    if (sig.every((b, i) => bytes[i] === b)) {
      mime = type
      ext = e
    }
  }
  if (!ext && bytes[0] === 0x52 && bytes[8] === 0x57 && bytes[9] === 0x45) {
    mime = 'image/webp'
    ext = 'webp'
  }
  if (!ext && /^\s*<(\?xml|svg)/i.test(new TextDecoder().decode(bytes.slice(0, 200)))) {
    mime = 'image/svg+xml'
    ext = 'svg'
  }
  if (!mime) throw new Error('This data does not look like a known image type.')
  return { bytes, mime, ext: ext ?? mime.split('/')[1].replace('svg+xml', 'svg') }
}

export function Base64ToImage() {
  const [text, setText] = useState('')
  const [failed, setFailed] = useState(false)

  const result = useMemo(() => {
    if (!text.trim()) return { image: null, error: '' }
    try {
      const { bytes, mime, ext } = decodeBase64(text)
      return { image: { blob: new Blob([bytes], { type: mime }), ext, size: bytes.length }, error: '' }
    } catch (e) {
      return { image: null, error: e.message }
    }
  }, [text])

  const url = useObjectUrl(result.image?.blob ?? null)

  return (
    <div className="tp-stack">
      <Field label="Base64 or data URI">
        <textarea
          className="tp-textarea tp-mono"
          rows={8}
          value={text}
          onChange={(e) => {
            setFailed(false)
            setText(e.target.value)
          }}
          placeholder="data:image/png;base64,iVBORw0KGgo…"
          spellCheck="false"
        />
      </Field>
      <Notice>{result.error || (failed ? 'The text decoded, but it is not a picture the browser can show.' : '')}</Notice>
      {result.image && (
        <div className="tp-workspace">
          <div className="tp-panel">
            <dl className="tp-stats">
              <div>
                <dt>Type</dt>
                <dd>{result.image.ext.toUpperCase()}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{formatBytes(result.image.size)}</dd>
              </div>
            </dl>
            <Button icon={<TbDownload aria-hidden="true" />} onClick={() => downloadBlob(result.image.blob, `image.${result.image.ext}`)}>
              Download image.{result.image.ext}
            </Button>
          </div>
          <div className="tp-preview">{url && <img className="tp-canvas" src={url} alt="Decoded preview" onError={() => setFailed(true)} />}</div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Aspect Ratio Calculator

const gcd = (a, b) => (b ? gcd(b, a % b) : a)

const COMMON = [
  ['16:9', 16, 9], ['9:16', 9, 16], ['4:3', 4, 3], ['3:2', 3, 2], ['1:1', 1, 1], ['4:5', 4, 5], ['21:9', 21, 9], ['2:3', 2, 3],
]

export function AspectRatioCalculator() {
  const [w, setW] = useState(1920)
  const [h, setH] = useState(1080)
  const [rw, setRw] = useState(16)
  const [rh, setRh] = useState(9)
  const [known, setKnown] = useState('width')
  const [value, setValue] = useState(1280)

  const wholeW = Number.isInteger(w) && w > 0
  const wholeH = Number.isInteger(h) && h > 0
  const d = wholeW && wholeH ? gcd(w, h) : 1
  const exact = wholeW && wholeH ? `${w / d}:${h / d}` : null
  const decimal = w > 0 && h > 0 ? (w / h).toFixed(4).replace(/\.?0+$/, '') : null
  const near = w > 0 && h > 0 ? COMMON.find(([, a, b]) => Math.abs(a / b - w / h) < 0.01) : null

  const ratioOk = rw > 0 && rh > 0
  const missing = ratioOk && value > 0 ? (known === 'width' ? (value * rh) / rw : (value * rw) / rh) : null
  const pretty = (n) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)))

  return (
    <div className="tp-stack">
      <section className="tp-card">
        <h2>Find the ratio</h2>
        <div className="tp-two">
          <NumberInput label="Width" value={w} onChange={setW} min={1} unit="px" />
          <NumberInput label="Height" value={h} onChange={setH} min={1} unit="px" />
        </div>
        {exact ? (
          <div className="tp-answer">
            <strong>{exact}</strong>
            <span>{decimal} : 1</span>
            {near && exact !== near[0] && <span>Close to {near[0]}</span>}
          </div>
        ) : (
          <Notice>Enter a whole width and height above zero.</Notice>
        )}
        {exact && <CopyButton text={exact} label="Copy ratio" />}
      </section>

      <section className="tp-card">
        <h2>Find the missing size</h2>
        <div className="tp-chips tp-presets">
          {COMMON.map(([label, a, b]) => (
            <button key={label} type="button" className={`tp-pill${rw === a && rh === b ? ' is-active' : ''}`} onClick={() => { setRw(a); setRh(b) }}>
              {label}
            </button>
          ))}
        </div>
        <div className="tp-two">
          <NumberInput label="Ratio width" value={rw} onChange={setRw} min={1} step="any" />
          <NumberInput label="Ratio height" value={rh} onChange={setRh} min={1} step="any" />
        </div>
        <div className="tp-two">
          <Select label="I know the" value={known} onChange={setKnown} options={[{ value: 'width', label: 'Width' }, { value: 'height', label: 'Height' }]} />
          <NumberInput label={known === 'width' ? 'Width' : 'Height'} value={value} onChange={setValue} min={1} step="any" unit="px" />
        </div>
        {missing ? (
          <div className="tp-answer">
            <strong>
              {known === 'width' ? `${pretty(value)} × ${pretty(missing)}` : `${pretty(missing)} × ${pretty(value)}`}
            </strong>
            <span>{known === 'width' ? 'Height' : 'Width'}: {pretty(missing)}px</span>
          </div>
        ) : (
          <Notice>Enter a ratio and a size above zero.</Notice>
        )}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------- Text Compare

// Line-by-line diff using the longest common subsequence. Identical lines at the start and end
// are skipped first, which keeps the table small for typical edits.
function diffLines(aText, bText, { ignoreCase, ignoreSpace }) {
  const split = (t) => (t === '' ? [] : t.replace(/\r\n?/g, '\n').split('\n'))
  const A = split(aText)
  const B = split(bText)
  const norm = (s) => {
    let t = s
    if (ignoreSpace) t = t.replace(/\s+/g, ' ').trim()
    if (ignoreCase) t = t.toLowerCase()
    return t
  }
  const na = A.map(norm)
  const nb = B.map(norm)
  let start = 0
  while (start < A.length && start < B.length && na[start] === nb[start]) start++
  let endA = A.length
  let endB = B.length
  while (endA > start && endB > start && na[endA - 1] === nb[endB - 1]) {
    endA--
    endB--
  }
  const n = endA - start
  const m = endB - start
  if (n > 65000 || m > 65000 || n * m > 16e6) return null

  const w = m + 1
  const dp = new Uint16Array((n + 1) * w)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = na[start + i] === nb[start + j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1])
    }
  }

  const ops = []
  for (let i = 0; i < start; i++) ops.push({ t: 'same', a: i + 1, b: i + 1, text: A[i] })
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && na[start + i] === nb[start + j]) {
      ops.push({ t: 'same', a: start + i + 1, b: start + j + 1, text: A[start + i] })
      i++
      j++
    } else if (i < n && (j === m || dp[(i + 1) * w + j] >= dp[i * w + j + 1])) {
      // Removed lines come before the lines that replace them.
      ops.push({ t: 'del', a: start + i + 1, text: A[start + i] })
      i++
    } else {
      ops.push({ t: 'add', b: start + j + 1, text: B[start + j] })
      j++
    }
  }
  for (let k = 0; k < A.length - endA; k++) ops.push({ t: 'same', a: endA + k + 1, b: endB + k + 1, text: A[endA + k] })
  return ops
}

export function TextCompare() {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [ignoreCase, setIgnoreCase] = useState(false)
  const [ignoreSpace, setIgnoreSpace] = useState(false)
  const [changesOnly, setChangesOnly] = useState(false)

  const ops = useMemo(() => diffLines(a, b, { ignoreCase, ignoreSpace }), [a, b, ignoreCase, ignoreSpace])
  const added = ops?.filter((o) => o.t === 'add').length ?? 0
  const removed = ops?.filter((o) => o.t === 'del').length ?? 0

  const rows = useMemo(() => {
    if (!ops || !changesOnly) return ops
    const keep = new Set()
    ops.forEach((o, i) => {
      if (o.t !== 'same') for (let k = Math.max(0, i - 2); k <= Math.min(ops.length - 1, i + 2); k++) keep.add(k)
    })
    const out = []
    ops.forEach((o, i) => {
      if (keep.has(i)) out.push(o)
      else if (out[out.length - 1]?.t !== 'gap') out.push({ t: 'gap' })
    })
    return out
  }, [ops, changesOnly])

  const both = a.length > 0 || b.length > 0

  return (
    <div className="tp-stack">
      <div className="tp-two tp-compare-inputs">
        <Field label="Original text">
          <textarea className="tp-textarea tp-mono" rows={10} value={a} onChange={(e) => setA(e.target.value)} spellCheck="false" placeholder="Paste the first version here" />
        </Field>
        <Field label="Changed text">
          <textarea className="tp-textarea tp-mono" rows={10} value={b} onChange={(e) => setB(e.target.value)} spellCheck="false" placeholder="Paste the second version here" />
        </Field>
      </div>
      <div className="tp-row">
        <Toggle label="Ignore capital letters" checked={ignoreCase} onChange={setIgnoreCase} />
        <Toggle label="Ignore extra spaces" checked={ignoreSpace} onChange={setIgnoreSpace} />
        <Toggle label="Show changes only" checked={changesOnly} onChange={setChangesOnly} />
      </div>
      {ops === null && <Notice>These texts are too long to compare line by line here. Try comparing smaller parts.</Notice>}
      {ops && both && (
        <>
          <p className="tp-diffsummary" role="status">
            {added === 0 && removed === 0 ? (
              'The texts are identical.'
            ) : (
              <>
                <span className="is-add">+{added} added</span> <span className="is-del">−{removed} removed</span>
              </>
            )}
          </p>
          <div className="tp-diff" role="table" aria-label="Differences">
            {rows.map((r, i) =>
              r.t === 'gap' ? (
                <div className="tp-diffrow is-gap" key={`g${i}`}>
                  <span />
                  <span />
                  <span />
                  <code>…</code>
                </div>
              ) : (
                <div className={`tp-diffrow is-${r.t}`} key={i}>
                  <span>{r.a ?? ''}</span>
                  <span>{r.b ?? ''}</span>
                  <span aria-label={r.t === 'add' ? 'added' : r.t === 'del' ? 'removed' : 'unchanged'}>{r.t === 'add' ? '+' : r.t === 'del' ? '−' : ''}</span>
                  <code>{r.text || ' '}</code>
                </div>
              ),
            )}
          </div>
        </>
      )}
    </div>
  )
}
