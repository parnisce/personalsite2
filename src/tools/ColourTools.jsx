import { useEffect, useMemo, useRef, useState } from 'react'
import { TbArrowsExchange, TbDice3, TbPlus, TbX } from 'react-icons/tb'
import { contrastRatio, hslString, hslToRgb, parseHex, readableOn, rgbString, rgbToHsl, SCHEMES, toHex } from './lib/colour'
import { loadImage, resample } from './lib/image'
import { Busy, Button, ColorField, CopyButton, Field, FileDrop, Notice, NumberInput, Range, Select } from './lib/ui'

const IMAGE_ACCEPT = 'image/*,.heic,.heif,.tif,.tiff,.ico'

function Value({ label, value }) {
  return (
    <div className="tp-value">
      <span>{label}</span>
      <code>{value}</code>
      <CopyButton text={value} />
    </div>
  )
}

function Swatch({ hex, label, onClick }) {
  const rgb = parseHex(hex)
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} className="tp-swatch" style={{ background: hex, color: rgb ? readableOn(rgb) : '#fff' }} onClick={onClick}>
      <strong>{label ?? hex}</strong>
    </Tag>
  )
}

function useImageSource() {
  const [source, setSource] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const load = async ([file]) => {
    setLoading(true)
    setError('')
    try {
      setSource(await loadImage(file))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }
  return { source, error, loading, load }
}

function Picker({ state }) {
  return (
    <>
      <FileDrop accept={IMAGE_ACCEPT} onFiles={state.load} compact={!!state.source} hint="JPG, PNG, WebP, GIF, BMP, HEIC, TIFF and more" />
      {state.loading && <Busy label="Opening image…" />}
      <Notice>{state.error}</Notice>
    </>
  )
}

const describe = (rgb) => ({ hex: toHex(rgb), rgb: rgbString(rgb), hsl: hslString(rgbToHsl(rgb)) })

// ---------------------------------------------------------------- Colour Picker from Image

export function ColourPickerFromImage() {
  const state = useImageSource()
  const { source } = state
  const canvas = useRef(null)
  const [hover, setHover] = useState(null)
  const [picked, setPicked] = useState(null)
  const [history, setHistory] = useState([])

  useEffect(() => {
    const el = canvas.current
    if (!el || !source) return
    el.width = source.canvas.width
    el.height = source.canvas.height
    el.getContext('2d').drawImage(source.canvas, 0, 0)
    setPicked(null)
    setHistory([])
  }, [source])

  const read = (e) => {
    const el = canvas.current
    const rect = el.getBoundingClientRect()
    const x = Math.min(el.width - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * el.width)))
    const y = Math.min(el.height - 1, Math.max(0, Math.floor(((e.clientY - rect.top) / rect.height) * el.height)))
    const [r, g, b, a] = source.canvas.getContext('2d').getImageData(x, y, 1, 1).data
    return { r, g, b, a: a / 255, x, y }
  }

  const choose = (e) => {
    const c = read(e)
    setPicked(c)
    setHistory((h) => [toHex(c), ...h.filter((x) => x !== toHex(c))].slice(0, 12))
  }

  const shown = picked ?? hover
  return (
    <div className="tp-stack">
      <Picker state={state} />
      {source && (
        <div className="tp-workspace">
          <div className="tp-panel">
            <div className="tp-liveswatch" style={{ background: shown ? toHex(shown) : 'transparent' }}>
              {!shown && <span>Move over the image, then click to pick a colour.</span>}
            </div>
            {shown && (
              <>
                <Value label="HEX" value={describe(shown).hex} />
                <Value label="RGB" value={describe(shown).rgb} />
                <Value label="HSL" value={describe(shown).hsl} />
                <p className="tp-meta">
                  Pixel {shown.x}, {shown.y}
                  {shown.a < 1 && ` · ${Math.round(shown.a * 100)}% opaque`}
                </p>
              </>
            )}
            {history.length > 0 && (
              <div>
                <p className="tp-label">Picked colours</p>
                <div className="tp-chips">
                  {history.map((h) => (
                    <button key={h} type="button" className="tp-chip" style={{ background: h }} aria-label={`Colour ${h}`} title={h} onClick={() => navigator.clipboard?.writeText(h)} />
                  ))}
                </div>
                <p className="tp-hint">Click a swatch to copy its HEX code.</p>
              </div>
            )}
          </div>
          <div className="tp-preview">
            <canvas ref={canvas} className="tp-canvas tp-crosshair" onMouseMove={(e) => setHover(read(e))} onMouseLeave={() => setHover(null)} onClick={choose} />
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Colour Palette Extractor

function seeded(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function extractPalette(canvas, k) {
  const scale = Math.min(1, 120 / Math.max(canvas.width, canvas.height))
  const small = scale < 1 ? resample(canvas, canvas.width * scale, canvas.height * scale) : canvas
  const { data } = small.getContext('2d').getImageData(0, 0, small.width, small.height)
  const pts = []
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 128) pts.push([data[i], data[i + 1], data[i + 2]])
  if (!pts.length) return []
  const rand = seeded(7)
  const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
  // k-means++ start, then a few rounds of refinement.
  const centers = [pts[Math.floor(rand() * pts.length)]]
  while (centers.length < Math.min(k, pts.length)) {
    const d = pts.map((p) => Math.min(...centers.map((c) => dist(p, c))))
    const total = d.reduce((a, b) => a + b, 0)
    if (!total) break
    let r = rand() * total
    let i = 0
    while ((r -= d[i]) > 0 && i < d.length - 1) i++
    centers.push(pts[i])
  }
  let counts = []
  for (let round = 0; round < 12; round++) {
    const sums = centers.map(() => [0, 0, 0, 0])
    for (const p of pts) {
      let best = 0
      let bd = Infinity
      centers.forEach((c, i) => {
        const dd = dist(p, c)
        if (dd < bd) {
          bd = dd
          best = i
        }
      })
      sums[best][0] += p[0]
      sums[best][1] += p[1]
      sums[best][2] += p[2]
      sums[best][3]++
    }
    counts = sums.map((s) => s[3])
    sums.forEach((s, i) => {
      if (s[3]) centers[i] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]
    })
  }
  return centers
    .map((c, i) => ({ hex: toHex({ r: c[0], g: c[1], b: c[2] }), share: counts[i] / pts.length }))
    .filter((c) => c.share > 0)
    .sort((a, b) => b.share - a.share)
}

export function ColourPaletteExtractor() {
  const state = useImageSource()
  const { source } = state
  const [count, setCount] = useState(6)
  const palette = useMemo(() => (source ? extractPalette(source.canvas, count) : []), [source, count])
  const canvas = useRef(null)
  useEffect(() => {
    const el = canvas.current
    if (!el || !source) return
    el.width = source.canvas.width
    el.height = source.canvas.height
    el.getContext('2d').drawImage(source.canvas, 0, 0)
  }, [source])

  return (
    <div className="tp-stack">
      <Picker state={state} />
      {source && (
        <div className="tp-workspace">
          <div className="tp-panel">
            <Range label="Number of colours" value={count} onChange={setCount} min={3} max={10} />
            <div className="tp-swatches">
              {palette.map((c) => (
                <div key={c.hex} className="tp-swatchrow">
                  <Swatch hex={c.hex} />
                  <span className="tp-meta">{Math.round(c.share * 100)}%</span>
                  <CopyButton text={c.hex} />
                </div>
              ))}
            </div>
            {palette.length > 0 && <CopyButton text={palette.map((c) => c.hex).join(', ')} label="Copy all HEX codes" />}
          </div>
          <div className="tp-preview">
            <canvas ref={canvas} className="tp-canvas" />
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Colour Palette Generator

const randomHex = () => toHex(hslToRgb({ h: Math.random() * 360, s: 45 + Math.random() * 40, l: 40 + Math.random() * 25 }))

export function ColourPaletteGenerator() {
  const [base, setBase] = useState('#00B8D9')
  const [scheme, setScheme] = useState('harmony')
  const rgb = parseHex(base)
  const colours = useMemo(() => (rgb ? SCHEMES[scheme].make(rgbToHsl(rgb)).map((c) => toHex(hslToRgb(c))) : []), [rgb, scheme])
  return (
    <div className="tp-stack">
      <div className="tp-panel tp-inline">
        <ColorField label="Starting colour" value={base} onChange={setBase} />
        <Select label="Style" value={scheme} onChange={setScheme} options={Object.entries(SCHEMES).map(([value, s]) => ({ value, label: s.label }))} />
        <Button variant="ghost" icon={<TbDice3 aria-hidden="true" />} onClick={() => setBase(randomHex())}>
          Surprise me
        </Button>
      </div>
      {!rgb && <Notice>Enter a valid HEX colour, like #00B8D9.</Notice>}
      {colours.length > 0 && (
        <>
          <div className="tp-palette">
            {colours.map((hex) => (
              <div key={hex} className="tp-palettecol">
                <Swatch hex={hex} />
                <Value label="RGB" value={rgbString(parseHex(hex))} />
                <CopyButton text={hex} label="Copy HEX" />
              </div>
            ))}
          </div>
          <div className="tp-row">
            <CopyButton text={colours.join(', ')} label="Copy all HEX codes" />
            <CopyButton text={`:root {\n${colours.map((c, i) => `  --color-${i + 1}: ${c};`).join('\n')}\n}`} label="Copy as CSS variables" />
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- CSS Gradient Generator

let stopId = 10
const mkStop = (color, pos) => ({ id: ++stopId, color, pos })

export function CssGradientGenerator() {
  const [type, setType] = useState('linear')
  const [angle, setAngle] = useState(135)
  const [stops, setStops] = useState([mkStop('#00E5FF', 0), mkStop('#3A5BFF', 100)])
  const update = (id, patch) => setStops((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  const sorted = [...stops].sort((a, b) => a.pos - b.pos)
  const list = sorted.map((s) => `${s.color} ${s.pos}%`).join(', ')
  const css = type === 'linear' ? `linear-gradient(${angle}deg, ${list})` : type === 'radial' ? `radial-gradient(circle at center, ${list})` : `conic-gradient(from ${angle}deg at 50% 50%, ${list})`
  const add = () => setStops((cur) => [...cur, mkStop('#FFFFFF', 50)])

  return (
    <div className="tp-workspace">
      <div className="tp-panel">
        <Select label="Type" value={type} onChange={setType} options={[{ value: 'linear', label: 'Linear' }, { value: 'radial', label: 'Radial' }, { value: 'conic', label: 'Conic' }]} />
        {type !== 'radial' && <Range label={type === 'conic' ? 'Start angle' : 'Angle'} value={angle} onChange={setAngle} min={0} max={360} unit="°" />}
        <div className="tp-stops">
          {stops.map((s, i) => (
            <div key={s.id} className="tp-stop">
              <ColorField label={`Colour ${i + 1}`} value={s.color} onChange={(color) => update(s.id, { color })} />
              <Range label="Position" value={s.pos} onChange={(pos) => update(s.id, { pos })} unit="%" />
              {stops.length > 2 && (
                <button type="button" className="tp-icon-btn" aria-label={`Remove colour ${i + 1}`} onClick={() => setStops((cur) => cur.filter((x) => x.id !== s.id))}>
                  <TbX aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
        {stops.length < 6 && (
          <Button variant="ghost" icon={<TbPlus aria-hidden="true" />} onClick={add}>
            Add colour
          </Button>
        )}
      </div>
      <div className="tp-preview">
        <div className="tp-gradient" style={{ background: css }} role="img" aria-label="Gradient preview" />
        <pre className="tp-code">{`background: ${css};`}</pre>
        <CopyButton text={`background: ${css};`} label="Copy CSS" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Colour Contrast Checker

function Result({ label, need, ratio }) {
  const pass = ratio >= need
  return (
    <li className={pass ? 'is-pass' : 'is-fail'}>
      <span>{label}</span>
      <em>needs {need}:1</em>
      <strong>{pass ? 'Pass' : 'Fail'}</strong>
    </li>
  )
}

export function ColourContrastChecker() {
  const [fg, setFg] = useState('#E9F1FB')
  const [bg, setBg] = useState('#0B1220')
  const a = parseHex(fg)
  const b = parseHex(bg)
  const ratio = a && b ? contrastRatio(a, b) : null
  return (
    <div className="tp-workspace">
      <div className="tp-panel">
        <ColorField label="Text colour" value={fg} onChange={setFg} />
        <ColorField label="Background colour" value={bg} onChange={setBg} />
        <Button
          variant="ghost"
          icon={<TbArrowsExchange aria-hidden="true" />}
          onClick={() => {
            setFg(bg)
            setBg(fg)
          }}
        >
          Swap colours
        </Button>
        {(!a || !b) && <Notice>Enter valid HEX colours, like #1A2B3C.</Notice>}
      </div>
      <div className="tp-preview">
        {ratio && (
          <>
            <div className="tp-contrast-sample" style={{ color: fg, background: bg }}>
              <strong>Sample heading</strong>
              <span>The quick brown fox jumps over the lazy dog.</span>
            </div>
            <p className="tp-ratio">
              <strong>{ratio.toFixed(2)}</strong>:1
            </p>
            <ul className="tp-results-list">
              <Result label="AA · normal text" need={4.5} ratio={ratio} />
              <Result label="AA · large text" need={3} ratio={ratio} />
              <Result label="AAA · normal text" need={7} ratio={ratio} />
              <Result label="AAA · large text" need={4.5} ratio={ratio} />
              <Result label="AA · icons and UI parts" need={3} ratio={ratio} />
            </ul>
            <p className="tp-hint">Large text means 24px regular or 18.66px bold and above.</p>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- HEX <-> RGB

export function HexToRgb() {
  const [hex, setHex] = useState('#00B8D9')
  const c = parseHex(hex)
  return (
    <div className="tp-workspace">
      <div className="tp-panel">
        <ColorField label="HEX colour" value={hex} onChange={setHex} />
        {!c && <Notice>Enter 3, 4, 6 or 8 hex digits, like #0BD or #00B8D9.</Notice>}
      </div>
      <div className="tp-preview">
        {c && (
          <>
            <Swatch hex={toHex(c)} label={toHex(c)} />
            <Value label="RGB" value={rgbString(c)} />
            {c.a < 1 && <Value label="RGBA" value={`rgba(${c.r}, ${c.g}, ${c.b}, ${+c.a.toFixed(2)})`} />}
            <Value label="HSL" value={hslString(rgbToHsl(c))} />
            <Value label="Values" value={`${c.r}, ${c.g}, ${c.b}`} />
          </>
        )}
      </div>
    </div>
  )
}

export function RgbToHex() {
  const [rgb, setRgb] = useState({ r: 0, g: 184, b: 217 })
  const valid = ['r', 'g', 'b'].every((k) => Number.isFinite(rgb[k]) && rgb[k] >= 0 && rgb[k] <= 255)
  const set = (k) => (v) => setRgb((cur) => ({ ...cur, [k]: v }))
  return (
    <div className="tp-workspace">
      <div className="tp-panel">
        <div className="tp-three">
          <NumberInput label="Red" value={rgb.r} onChange={set('r')} min={0} max={255} />
          <NumberInput label="Green" value={rgb.g} onChange={set('g')} min={0} max={255} />
          <NumberInput label="Blue" value={rgb.b} onChange={set('b')} min={0} max={255} />
        </div>
        <Field label="Or pick a colour">
          <input type="color" value={valid ? toHex(rgb).toLowerCase() : '#000000'} onChange={(e) => setRgb(parseHex(e.target.value))} />
        </Field>
        {!valid && <Notice>Each value needs to be a whole number from 0 to 255.</Notice>}
      </div>
      <div className="tp-preview">
        {valid && (
          <>
            <Swatch hex={toHex(rgb)} />
            <Value label="HEX" value={toHex(rgb)} />
            <Value label="HEX (lowercase)" value={toHex(rgb).toLowerCase()} />
            <Value label="HSL" value={hslString(rgbToHsl(rgb))} />
          </>
        )}
      </div>
    </div>
  )
}
