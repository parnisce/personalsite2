import { useMemo, useRef, useState } from 'react'
import { TbDownload } from 'react-icons/tb'
import {
  baseName,
  downloadBlob,
  encodeCanvas,
  encodeIco,
  fitCanvas,
  formatBytes,
  loadImage,
  makeCanvas,
  resample,
  sourceFormat,
  zipBlobs,
} from './lib/image'
import {
  Busy,
  Button,
  CanvasView,
  ColorField,
  FileDrop,
  NumberInput,
  Notice,
  OutputBar,
  Range,
  Select,
  Toggle,
  useDebouncedEffect,
  useObjectUrl,
} from './lib/ui'

const IMAGE_ACCEPT = 'image/*,.heic,.heif,.tif,.tiff,.ico'
const HINT = 'JPG, PNG, WebP, GIF, BMP, HEIC, TIFF and more'

// Shared "pick an image" state used by every tool in this file.
function useSourceImage(onLoaded) {
  const [source, setSource] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const load = async ([file]) => {
    setLoading(true)
    setError('')
    try {
      const img = await loadImage(file)
      setSource(img)
      onLoaded?.(img, file)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }
  return { source, error, loading, load }
}

function Picker({ state, hint = HINT }) {
  return (
    <>
      <FileDrop accept={IMAGE_ACCEPT} onFiles={state.load} compact={!!state.source} hint={hint} />
      {state.loading && <Busy label="Opening image…" />}
      <Notice>{state.error}</Notice>
    </>
  )
}

// ---------------------------------------------------------------- Image Resizer

export function ImageResizer() {
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const [mode, setMode] = useState('pixels')
  const [percent, setPercent] = useState(50)
  const [lock, setLock] = useState(true)
  const [format, setFormat] = useState('png')
  const state = useSourceImage((img, file) => {
    setDims({ w: img.canvas.width, h: img.canvas.height })
    setFormat(sourceFormat(file))
  })
  const { source } = state
  const [result, setResult] = useState(null)

  const target = useMemo(() => {
    if (!source) return { w: 0, h: 0 }
    if (mode === 'percent') {
      return { w: Math.round((source.canvas.width * percent) / 100), h: Math.round((source.canvas.height * percent) / 100) }
    }
    return dims
  }, [source, mode, percent, dims])

  const valid = target.w >= 1 && target.h >= 1 && target.w <= 16000 && target.h <= 16000

  useDebouncedEffect(() => {
    if (source && valid) setResult(resample(source.canvas, target.w, target.h))
  }, [source, target.w, target.h, valid])

  const setW = (w) => {
    if (!source) return
    const ratio = source.canvas.height / source.canvas.width
    setDims({ w, h: lock && Number.isFinite(w) ? Math.round(w * ratio) : dims.h })
  }
  const setH = (h) => {
    if (!source) return
    const ratio = source.canvas.width / source.canvas.height
    setDims({ h, w: lock && Number.isFinite(h) ? Math.round(h * ratio) : dims.w })
  }

  return (
    <div className="tp-stack">
      <Picker state={state} />
      {source && (
        <div className="tp-workspace">
          <div className="tp-panel">
            <p className="tp-meta">
              Original: {source.canvas.width} × {source.canvas.height}px
            </p>
            <Select
              label="Resize by"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'pixels', label: 'Exact pixels' },
                { value: 'percent', label: 'Percentage' },
              ]}
            />
            {mode === 'pixels' ? (
              <>
                <div className="tp-two">
                  <NumberInput label="Width" value={dims.w} onChange={setW} min={1} max={16000} unit="px" />
                  <NumberInput label="Height" value={dims.h} onChange={setH} min={1} max={16000} unit="px" />
                </div>
                <Toggle label="Keep the aspect ratio" checked={lock} onChange={setLock} />
              </>
            ) : (
              <Range label="Scale" value={percent} onChange={setPercent} min={5} max={300} unit="%" />
            )}
            {!valid && <Notice>Enter a width and height between 1 and 16000 pixels.</Notice>}
            <OutputBar canvas={valid ? result : null} name={source.name} suffix="resized" format={format} onFormat={setFormat} />
          </div>
          <div className="tp-preview">
            <CanvasView canvas={result ?? source.canvas} />
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Image Cropper

const ASPECTS = [
  { value: 'free', label: 'Free' },
  { value: '1:1', label: 'Square 1:1' },
  { value: '4:3', label: '4:3' },
  { value: '3:2', label: '3:2' },
  { value: '16:9', label: '16:9' },
  { value: '4:5', label: 'Portrait 4:5' },
  { value: '9:16', label: 'Story 9:16' },
]

export function ImageCropper() {
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0 })
  const [aspect, setAspect] = useState('free')
  const [format, setFormat] = useState('png')
  const [result, setResult] = useState(null)
  const stage = useRef(null)
  const drag = useRef(null)
  const state = useSourceImage((img, file) => {
    const side = Math.min(img.canvas.width, img.canvas.height)
    setCrop({ x: Math.round((img.canvas.width - side) / 2), y: Math.round((img.canvas.height - side) / 2), w: side, h: side })
    setAspect('1:1')
    setFormat(sourceFormat(file))
  })
  const { source } = state
  const W = source?.canvas.width ?? 0
  const H = source?.canvas.height ?? 0

  const place = (next) => {
    const w = Math.min(Math.max(1, Math.round(next.w)), W)
    const h = Math.min(Math.max(1, Math.round(next.h)), H)
    setCrop({ w, h, x: Math.min(Math.max(0, Math.round(next.x)), W - w), y: Math.min(Math.max(0, Math.round(next.y)), H - h) })
  }

  const ratioOf = (a) => {
    if (a === 'free') return null
    const [x, y] = a.split(':').map(Number)
    return x / y
  }

  const pickAspect = (a) => {
    setAspect(a)
    const r = ratioOf(a)
    if (!r) return
    let w = crop.w
    let h = Math.round(w / r)
    if (h > H) {
      h = H
      w = Math.round(h * r)
    }
    if (w > W) {
      w = W
      h = Math.round(w / r)
    }
    place({ x: crop.x + (crop.w - w) / 2, y: crop.y + (crop.h - h) / 2, w, h })
  }

  const setWidth = (w) => {
    const r = ratioOf(aspect)
    place({ ...crop, w, h: r ? w / r : crop.h })
  }
  const setHeight = (h) => {
    const r = ratioOf(aspect)
    place({ ...crop, h, w: r ? h * r : crop.w })
  }

  useDebouncedEffect(() => {
    if (!source || crop.w < 1) return
    const out = makeCanvas(crop.w, crop.h)
    out.getContext('2d').drawImage(source.canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h)
    setResult(out)
  }, [source, crop], 60)

  // Drag the crop box on the preview.
  const onDown = (e) => {
    const rect = stage.current.getBoundingClientRect()
    drag.current = { sx: e.clientX, sy: e.clientY, crop, k: W / rect.width }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e) => {
    const d = drag.current
    if (!d) return
    place({ ...d.crop, x: d.crop.x + (e.clientX - d.sx) * d.k, y: d.crop.y + (e.clientY - d.sy) * d.k })
  }
  const onUp = () => {
    drag.current = null
  }
  const nudge = (e) => {
    const step = e.shiftKey ? 20 : 2
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    const m = moves[e.key]
    if (!m) return
    e.preventDefault()
    place({ ...crop, x: crop.x + m[0], y: crop.y + m[1] })
  }

  return (
    <div className="tp-stack">
      <Picker state={state} />
      {source && (
        <div className="tp-workspace">
          <div className="tp-panel">
            <Select label="Shape" value={aspect} onChange={pickAspect} options={ASPECTS} />
            <div className="tp-two">
              <NumberInput label="Width" value={crop.w} onChange={setWidth} min={1} max={W} unit="px" />
              <NumberInput label="Height" value={crop.h} onChange={setHeight} min={1} max={H} unit="px" />
            </div>
            <Range label="Position left / right" value={crop.x} onChange={(x) => place({ ...crop, x })} min={0} max={Math.max(0, W - crop.w)} unit="px" />
            <Range label="Position up / down" value={crop.y} onChange={(y) => place({ ...crop, y })} min={0} max={Math.max(0, H - crop.h)} unit="px" />
            <p className="tp-hint">Drag the box on the picture to move it, or use the arrow keys when it is focused.</p>
            <OutputBar canvas={result} name={source.name} suffix="cropped" format={format} onFormat={setFormat} />
          </div>
          <div className="tp-preview">
            <div className="tp-stage" ref={stage}>
              <CanvasView canvas={source.canvas} />
              <div
                className="tp-cropbox"
                role="slider"
                tabIndex={0}
                aria-label="Crop area. Use the arrow keys to move it."
                aria-valuetext={`${crop.w} by ${crop.h} pixels at ${crop.x}, ${crop.y}`}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onKeyDown={nudge}
                style={{
                  left: `${(crop.x / W) * 100}%`,
                  top: `${(crop.y / H) * 100}%`,
                  width: `${(crop.w / W) * 100}%`,
                  height: `${(crop.h / H) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Image Compressor

export function ImageCompressor() {
  const [quality, setQuality] = useState(70)
  const [format, setFormat] = useState('jpg')
  const [maxSide, setMaxSide] = useState(0)
  const [blob, setBlob] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const state = useSourceImage((img, file) => setFormat(sourceFormat(file) === 'webp' ? 'webp' : 'jpg'))
  const { source } = state
  const previewUrl = useObjectUrl(blob)

  useDebouncedEffect(() => {
    if (!source) return
    let cancelled = false
    const run = async () => {
      setBusy(true)
      try {
        let canvas = source.canvas
        const longest = Math.max(canvas.width, canvas.height)
        if (maxSide && longest > maxSide) {
          const k = maxSide / longest
          canvas = resample(canvas, canvas.width * k, canvas.height * k)
        }
        const out = await encodeCanvas(canvas, format, { quality: quality / 100 })
        if (!cancelled) {
          setBlob(out)
          setError('')
        }
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setBusy(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [source, quality, format, maxSide], 200)

  const saved = source && blob ? Math.round((1 - blob.size / source.size) * 100) : 0

  return (
    <div className="tp-stack">
      <Picker state={state} />
      {source && (
        <div className="tp-workspace">
          <div className="tp-panel">
            <Select
              label="Output format"
              value={format}
              onChange={setFormat}
              options={[
                { value: 'jpg', label: 'JPG (best for photos)' },
                { value: 'webp', label: 'WebP (smallest)' },
              ]}
            />
            <Range label="Quality" value={quality} onChange={setQuality} min={10} max={100} unit="%" />
            <Select
              label="Longest side"
              value={String(maxSide)}
              onChange={(v) => setMaxSide(Number(v))}
              options={[
                { value: '0', label: 'Keep original size' },
                { value: '3840', label: '3840 px' },
                { value: '2560', label: '2560 px' },
                { value: '1920', label: '1920 px' },
                { value: '1280', label: '1280 px' },
                { value: '800', label: '800 px' },
              ]}
            />
            <dl className="tp-stats">
              <div>
                <dt>Original</dt>
                <dd>{formatBytes(source.size)}</dd>
              </div>
              <div>
                <dt>Compressed</dt>
                <dd>{blob ? formatBytes(blob.size) : '…'}</dd>
              </div>
              <div>
                <dt>{saved >= 0 ? 'Saved' : 'Larger by'}</dt>
                <dd>{blob ? `${Math.abs(saved)}%` : '…'}</dd>
              </div>
            </dl>
            {saved < 0 && <Notice kind="info">This image is already well compressed. Lower the quality or the size to shrink it further.</Notice>}
            <Button
              disabled={!blob || busy}
              icon={<TbDownload aria-hidden="true" />}
              onClick={() => downloadBlob(blob, `${baseName(source.name)}-compressed.${format}`)}
            >
              Download
            </Button>
            <Notice>{error}</Notice>
          </div>
          <div className="tp-preview">{previewUrl ? <img className="tp-canvas" src={previewUrl} alt="Compressed preview" /> : <Busy />}</div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Social Media Image Resizer

const SOCIAL = [
  { group: 'Instagram', items: [['Post (square)', 1080, 1080], ['Portrait post', 1080, 1350], ['Story / Reel', 1080, 1920]] },
  { group: 'Facebook', items: [['Shared image', 1200, 630], ['Cover photo', 820, 312], ['Story', 1080, 1920]] },
  { group: 'X (Twitter)', items: [['Post image', 1600, 900], ['Header', 1500, 500], ['Profile photo', 400, 400]] },
  { group: 'LinkedIn', items: [['Post image', 1200, 627], ['Banner', 1584, 396], ['Profile photo', 400, 400]] },
  { group: 'YouTube', items: [['Thumbnail', 1280, 720], ['Channel banner', 2560, 1440], ['Profile photo', 800, 800]] },
  { group: 'Pinterest', items: [['Standard pin', 1000, 1500], ['Square pin', 1000, 1000]] },
]
const SOCIAL_OPTIONS = SOCIAL.flatMap((g) =>
  g.items.map(([name, w, h]) => ({ value: `${g.group}|${name}|${w}|${h}`, label: `${g.group} · ${name} (${w}×${h})` })),
)

export function SocialResizer() {
  const [preset, setPreset] = useState(SOCIAL_OPTIONS[0].value)
  const [fit, setFit] = useState('cover')
  const [fx, setFx] = useState(50)
  const [fy, setFy] = useState(50)
  const [bg, setBg] = useState('#000000')
  const [format, setFormat] = useState('jpg')
  const [result, setResult] = useState(null)
  const state = useSourceImage()
  const { source } = state
  const [, , w, h] = preset.split('|')

  useDebouncedEffect(() => {
    if (!source) return
    setResult(fitCanvas(source.canvas, Number(w), Number(h), { mode: fit, focusX: fx / 100, focusY: fy / 100, background: bg }))
  }, [source, preset, fit, fx, fy, bg], 60)

  const slug = preset.split('|').slice(0, 2).join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-')

  return (
    <div className="tp-stack">
      <Picker state={state} />
      {source && (
        <div className="tp-workspace">
          <div className="tp-panel">
            <Select label="Platform and size" value={preset} onChange={setPreset} options={SOCIAL_OPTIONS} />
            <Select
              label="Fit"
              value={fit}
              onChange={setFit}
              options={[
                { value: 'cover', label: 'Fill the frame (crops the edges)' },
                { value: 'contain', label: 'Fit inside (adds bars)' },
              ]}
            />
            {fit === 'cover' ? (
              <>
                <Range label="Focus left / right" value={fx} onChange={setFx} unit="%" />
                <Range label="Focus up / down" value={fy} onChange={setFy} unit="%" />
              </>
            ) : (
              <ColorField label="Bar colour" value={bg} onChange={setBg} />
            )}
            <OutputBar canvas={result} name={source.name} suffix={slug} format={format} onFormat={setFormat} />
          </div>
          <div className="tp-preview">
            <CanvasView canvas={result ?? source.canvas} />
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Favicon Generator

const FAVICON_SIZES = [16, 32, 48, 64, 128, 256]

export function FaviconGenerator() {
  const [sizes, setSizes] = useState([16, 32, 48])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const state = useSourceImage()
  const { source } = state

  const toggle = (s) => setSizes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))

  const square = useMemo(() => {
    if (!source) return null
    const side = Math.min(source.canvas.width, source.canvas.height)
    const out = makeCanvas(side, side)
    out.getContext('2d').drawImage(source.canvas, (side - source.canvas.width) / 2, (side - source.canvas.height) / 2)
    return out
  }, [source])

  const run = async (kind) => {
    setBusy(true)
    setError('')
    try {
      if (kind === 'ico') {
        downloadBlob(await encodeIco(square, sizes), 'favicon.ico')
      } else {
        const files = []
        for (const s of [...sizes, 180].sort((a, b) => a - b)) {
          const name = s === 180 ? 'apple-touch-icon.png' : `favicon-${s}x${s}.png`
          files.push({ name, blob: await encodeCanvas(resample(square, s, s), 'png') })
        }
        downloadBlob(await zipBlobs(files), 'favicons.zip')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tp-stack">
      <Picker state={state} hint="Square images work best. Others are centre-cropped." />
      {source && (
        <div className="tp-workspace">
          <div className="tp-panel">
            <fieldset className="tp-fieldset">
              <legend>Sizes inside favicon.ico</legend>
              {FAVICON_SIZES.map((s) => (
                <Toggle key={s} label={`${s} × ${s}`} checked={sizes.includes(s)} onChange={() => toggle(s)} />
              ))}
            </fieldset>
            <div className="tp-row">
              <Button disabled={busy || !sizes.length} onClick={() => run('ico')} icon={<TbDownload aria-hidden="true" />}>
                Download favicon.ico
              </Button>
              <Button variant="ghost" disabled={busy || !sizes.length} onClick={() => run('zip')}>
                PNG set (.zip)
              </Button>
            </div>
            <p className="tp-hint">The PNG set also includes a 180 × 180 apple-touch-icon.</p>
            <Notice>{error}</Notice>
          </div>
          <div className="tp-preview tp-favicons">
            {[16, 32, 64, 128].map((s) => (
              <figure key={s}>
                <CanvasView canvas={square ? resample(square, s, s) : null} />
                <figcaption>{s}px</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Background Remover

export function BackgroundRemover() {
  const [blob, setBlob] = useState(null)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const [original, setOriginal] = useState(null)
  const [bg, setBg] = useState('checker')
  const originalUrl = useObjectUrl(original)
  const resultUrl = useObjectUrl(blob)
  const name = useRef('image')

  const run = async ([file]) => {
    setError('')
    setBlob(null)
    setProgress({ label: 'Getting ready…', value: 0 })
    name.current = file.name
    try {
      // HEIC/TIFF are converted first, since the model only reads common web formats.
      const loaded = await loadImage(file)
      const input = await encodeCanvas(loaded.canvas, 'png')
      setOriginal(input)
      const { removeBackground } = await import('@imgly/background-removal')
      const out = await removeBackground(input, {
        output: { format: 'image/png' },
        progress: (key, current, total) => {
          const downloading = key.startsWith('fetch')
          setProgress({
            label: downloading ? 'Downloading the AI model (first time only)…' : 'Removing the background…',
            value: total ? current / total : 0,
          })
        },
      })
      setBlob(out)
    } catch (e) {
      setError(
        /fetch|network|load/i.test(e.message)
          ? 'The AI model could not be downloaded. Check your connection and try again.'
          : `Could not remove the background: ${e.message}`,
      )
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="tp-stack">
      <FileDrop accept={IMAGE_ACCEPT} onFiles={run} compact={!!original} hint="Works best with a clear subject. The first run downloads a small AI model." />
      {progress && (
        <div className="tp-progress" role="status">
          <span>{progress.label}</span>
          <progress max="1" value={progress.value || undefined} />
        </div>
      )}
      <Notice>{error}</Notice>
      {original && (
        <div className="tp-compare">
          <figure>
            <figcaption>Original</figcaption>
            {originalUrl && <img className="tp-canvas" src={originalUrl} alt="Original" />}
          </figure>
          <figure>
            <figcaption>Background removed</figcaption>
            <div className={`tp-bgpreview bg-${bg}`}>{resultUrl && <img className="tp-canvas" src={resultUrl} alt="Result with transparent background" />}</div>
          </figure>
        </div>
      )}
      {blob && (
        <div className="tp-row">
          <Select
            label="Preview on"
            value={bg}
            onChange={setBg}
            options={[
              { value: 'checker', label: 'Transparent' },
              { value: 'white', label: 'White' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
          <Button icon={<TbDownload aria-hidden="true" />} onClick={() => downloadBlob(blob, `${baseName(name.current)}-no-background.png`)}>
            Download PNG
          </Button>
        </div>
      )}
    </div>
  )
}
