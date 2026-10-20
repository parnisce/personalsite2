import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { TbCheck, TbCopy, TbDownload, TbUpload } from 'react-icons/tb'
import { baseName, downloadBlob, encodeCanvas, FORMATS, formatBytes } from './image'

// ---------- file input ----------

export function FileDrop({ accept, multiple = false, onFiles, label, hint, compact = false }) {
  const [over, setOver] = useState(false)
  const id = useId()
  const take = (list) => {
    const files = [...list]
    if (files.length) onFiles(multiple ? files : files.slice(0, 1))
  }
  return (
    <label
      htmlFor={id}
      className={`tp-drop${over ? ' is-over' : ''}${compact ? ' is-compact' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        take(e.dataTransfer.files)
      }}
    >
      <TbUpload aria-hidden="true" />
      <strong>{label ?? (multiple ? 'Drop files here or click to choose' : 'Drop a file here or click to choose')}</strong>
      {hint && <span>{hint}</span>}
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          take(e.target.files)
          e.target.value = ''
        }}
      />
    </label>
  )
}

// ---------- form controls ----------

export function Field({ label, children, hint, className = '' }) {
  return (
    <label className={`tp-field ${className}`}>
      <span className="tp-label">{label}</span>
      {children}
      {hint && <span className="tp-hint">{hint}</span>}
    </label>
  )
}

export function Range({ label, value, onChange, min = 0, max = 100, step = 1, unit = '' }) {
  return (
    <Field label={`${label}: ${value}${unit}`}>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </Field>
  )
}

export function NumberInput({ label, value, onChange, min, max, step = 1, unit }) {
  return (
    <Field label={label}>
      <span className="tp-input-wrap">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
        />
        {unit && <em>{unit}</em>}
      </span>
    </Field>
  )
}

export function Select({ label, value, onChange, options }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const opt = typeof o === 'string' ? { value: o, label: o } : o
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          )
        })}
      </select>
    </Field>
  )
}

export function Toggle({ label, checked, onChange }) {
  return (
    <label className="tp-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

export function ColorField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <span className="tp-color">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <input
          type="text"
          value={value}
          spellCheck="false"
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} hex value`}
        />
      </span>
    </Field>
  )
}

// Renders a schema of controls: [{key, type, label, ...}] bound to a values object.
export function Controls({ schema, values, onChange }) {
  const set = (key) => (v) => onChange({ ...values, [key]: v })
  return (
    <div className="tp-controls">
      {schema
        .filter((c) => !c.show || c.show(values))
        .map((c) => {
          const common = { label: c.label, value: values[c.key], onChange: set(c.key) }
          if (c.type === 'range') return <Range key={c.key} {...common} min={c.min} max={c.max} step={c.step} unit={c.unit} />
          if (c.type === 'select') return <Select key={c.key} {...common} options={c.options} />
          if (c.type === 'color') return <ColorField key={c.key} {...common} />
          if (c.type === 'checkbox') return <Toggle key={c.key} label={c.label} checked={values[c.key]} onChange={set(c.key)} />
          if (c.type === 'number') return <NumberInput key={c.key} {...common} min={c.min} max={c.max} step={c.step} unit={c.unit} />
          return null
        })}
    </div>
  )
}

export const defaultsOf = (schema) => Object.fromEntries(schema.map((c) => [c.key, c.default]))

// ---------- buttons & feedback ----------

export function Button({ children, variant = 'primary', icon, ...props }) {
  return (
    <button type="button" className={`btn ${variant === 'primary' ? 'btn-primary' : 'btn-ghost'} btn-sm`} {...props}>
      {icon}
      {children}
    </button>
  )
}

export function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const area = document.createElement('textarea')
      area.value = text
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setDone(true)
    setTimeout(() => setDone(false), 1400)
  }
  return (
    <button type="button" className="tp-copy" onClick={copy}>
      {done ? <TbCheck aria-hidden="true" /> : <TbCopy aria-hidden="true" />}
      {done ? 'Copied' : label}
    </button>
  )
}

export function Notice({ kind = 'error', children }) {
  if (!children) return null
  return (
    <p className={`tp-notice is-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  )
}

export function Busy({ label = 'Working…' }) {
  return (
    <p className="tp-busy" role="status">
      <span className="tp-spinner" aria-hidden="true" /> {label}
    </p>
  )
}

// ---------- previews ----------

// Shows a canvas inside the page. Re-copies pixels when the canvas object changes.
export function CanvasView({ canvas, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !canvas) return
    el.width = canvas.width
    el.height = canvas.height
    el.getContext('2d').drawImage(canvas, 0, 0)
  }, [canvas])
  return <canvas ref={ref} className={`tp-canvas ${className}`} />
}

export function useObjectUrl(blob) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!blob) return undefined
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return blob ? url : null
}

// Runs fn after `delay` ms of no changes to `deps`; cancels stale runs.
export function useDebouncedEffect(fn, deps, delay = 80) {
  const latest = useRef(fn)
  latest.current = fn
  useEffect(() => {
    const t = setTimeout(() => latest.current(), delay)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

// Output format picker + download button for a finished canvas.
export function OutputBar({ canvas, name, suffix = 'edited', formats = ['png', 'jpg', 'webp'], format, onFormat }) {
  const [quality, setQuality] = useState(90)
  const [bg, setBg] = useState('#ffffff')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lossy = format === 'jpg' || format === 'webp'
  const needsBg = format === 'jpg' || format === 'bmp' || format === 'tiff'

  const download = useCallback(async () => {
    if (!canvas) return
    setBusy(true)
    setError('')
    try {
      const blob = await encodeCanvas(canvas, format, { quality: quality / 100, background: bg })
      downloadBlob(blob, `${baseName(name)}-${suffix}.${FORMATS[format].ext}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }, [canvas, format, quality, bg, name, suffix])

  return (
    <div className="tp-output">
      <Select
        label="Save as"
        value={format}
        onChange={onFormat}
        options={formats.map((f) => ({ value: f, label: FORMATS[f].label }))}
      />
      {lossy && <Range label="Quality" value={quality} onChange={setQuality} min={30} max={100} unit="%" />}
      {needsBg && <ColorField label="Background" value={bg} onChange={setBg} />}
      <Button onClick={download} disabled={!canvas || busy} icon={<TbDownload aria-hidden="true" />}>
        {busy ? 'Preparing…' : 'Download'}
      </Button>
      {canvas && (
        <span className="tp-meta">
          {canvas.width} × {canvas.height}px
        </span>
      )}
      <Notice>{error}</Notice>
    </div>
  )
}

export { formatBytes }
