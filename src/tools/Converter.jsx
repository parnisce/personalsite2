import { useCallback, useEffect, useRef, useState } from 'react'
import { TbDownload, TbX } from 'react-icons/tb'
import { baseName, downloadBlob, encodeCanvas, FORMATS, formatBytes, loadImage, zipBlobs } from './lib/image'
import { Button, ColorField, FileDrop, Notice, Range, Select, Toggle, useObjectUrl } from './lib/ui'

// What each converter accepts and produces. `from` becomes the file picker filter; files that
// don't match are still tried, because browsers often mislabel types.
export const CONVERTERS = {
  'image-format-converter': { from: 'image/*,.heic,.heif,.tif,.tiff,.ico', fromLabel: 'Any image', to: null },
  'heic-to-jpg': { from: '.heic,.heif,image/heic,image/heif', fromLabel: 'HEIC', to: 'jpg' },
  'heic-to-png': { from: '.heic,.heif,image/heic,image/heif', fromLabel: 'HEIC', to: 'png' },
  'webp-to-jpg': { from: '.webp,image/webp', fromLabel: 'WEBP', to: 'jpg' },
  'webp-to-png': { from: '.webp,image/webp', fromLabel: 'WEBP', to: 'png' },
  'png-to-jpg': { from: '.png,image/png', fromLabel: 'PNG', to: 'jpg' },
  'png-to-webp': { from: '.png,image/png', fromLabel: 'PNG', to: 'webp' },
  'jpg-to-webp': { from: '.jpg,.jpeg,image/jpeg', fromLabel: 'JPG', to: 'webp' },
  'jpg-to-png': { from: '.jpg,.jpeg,image/jpeg', fromLabel: 'JPG', to: 'png' },
  'jpeg-to-png': { from: '.jpeg,.jpg,image/jpeg', fromLabel: 'JPEG', to: 'png' },
  'svg-to-png': { from: '.svg,image/svg+xml', fromLabel: 'SVG', to: 'png' },
  'svg-to-jpg': { from: '.svg,image/svg+xml', fromLabel: 'SVG', to: 'jpg' },
  'avif-to-jpg': { from: '.avif,image/avif', fromLabel: 'AVIF', to: 'jpg' },
  'avif-to-png': { from: '.avif,image/avif', fromLabel: 'AVIF', to: 'png' },
  'tiff-to-jpg': { from: '.tif,.tiff,image/tiff', fromLabel: 'TIFF', to: 'jpg' },
  'tiff-to-png': { from: '.tif,.tiff,image/tiff', fromLabel: 'TIFF', to: 'png' },
  'png-to-ico': { from: '.png,image/png', fromLabel: 'PNG', to: 'ico' },
  'ico-to-png': { from: '.ico,image/x-icon,image/vnd.microsoft.icon', fromLabel: 'ICO', to: 'png' },
  'gif-to-jpg': { from: '.gif,image/gif', fromLabel: 'GIF', to: 'jpg', note: 'Animated GIFs convert their first frame.' },
  'bmp-to-jpg': { from: '.bmp,image/bmp', fromLabel: 'BMP', to: 'jpg' },
  'bmp-to-png': { from: '.bmp,image/bmp', fromLabel: 'BMP', to: 'png' },
  'jpg-to-bmp': { from: '.jpg,.jpeg,image/jpeg', fromLabel: 'JPG', to: 'bmp' },
  'jpg-to-tiff': { from: '.jpg,.jpeg,image/jpeg', fromLabel: 'JPG', to: 'tiff' },
}

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
const nextId = (() => {
  let n = 0
  return () => ++n
})()

function Row({ item, onRemove }) {
  const url = useObjectUrl(item.blob)
  return (
    <li className="tp-file">
      <span className="tp-thumb">{url && item.format !== 'tiff' && item.format !== 'bmp' ? <img src={url} alt="" /> : null}</span>
      <span className="tp-file-main">
        <strong title={item.name}>{item.name}</strong>
        <small>
          {item.status === 'working' && 'Converting…'}
          {item.status === 'error' && <span className="tp-err">{item.error}</span>}
          {item.status === 'done' && `${item.dims} · ${formatBytes(item.size)} → ${formatBytes(item.blob.size)}`}
        </small>
      </span>
      {item.status === 'done' && (
        <Button variant="ghost" onClick={() => downloadBlob(item.blob, item.outName)} icon={<TbDownload aria-hidden="true" />}>
          Save
        </Button>
      )}
      <button type="button" className="tp-icon-btn" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item.id)}>
        <TbX aria-hidden="true" />
      </button>
    </li>
  )
}

export default function Converter({ slug }) {
  const config = CONVERTERS[slug]
  const [target, setTarget] = useState(config.to ?? 'png')
  const [quality, setQuality] = useState(90)
  const [bg, setBg] = useState('#ffffff')
  const [icoSizes, setIcoSizes] = useState([16, 32, 48, 64, 128, 256])
  const [items, setItems] = useState([])
  const [zipping, setZipping] = useState(false)
  const sources = useRef(new Map()) // id -> File, so settings changes can re-convert

  const options = { quality: quality / 100, background: bg, icoSizes }

  const convert = useCallback(async (id, file, format, opts) => {
    try {
      const { canvas } = await loadImage(file)
      const blob = await encodeCanvas(canvas, format, opts)
      const outName = `${baseName(file.name)}.${FORMATS[format].ext}`
      setItems((cur) =>
        cur.map((it) =>
          it.id === id
            ? { ...it, status: 'done', blob, outName, size: file.size, dims: `${canvas.width}×${canvas.height}`, format }
            : it,
        ),
      )
    } catch (e) {
      setItems((cur) => cur.map((it) => (it.id === id ? { ...it, status: 'error', error: e.message } : it)))
    }
  }, [])

  const onFiles = async (files) => {
    const added = files.map((f) => ({ id: nextId(), name: f.name, size: f.size, status: 'working', file: f }))
    added.forEach((a) => sources.current.set(a.id, a.file))
    setItems((cur) => [...cur, ...added.map(({ file: _file, ...rest }) => rest)])
    for (const a of added) await convert(a.id, a.file, target, options) // one at a time keeps memory low
  }

  // Re-convert everything when the output settings change.
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return undefined
    }
    const t = setTimeout(async () => {
      const ids = [...sources.current.keys()]
      setItems((cur) => cur.map((it) => ({ ...it, status: 'working' })))
      for (const id of ids) await convert(id, sources.current.get(id), target, options)
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, quality, bg, icoSizes.join()])

  const remove = (id) => {
    sources.current.delete(id)
    setItems((cur) => cur.filter((it) => it.id !== id))
  }

  const done = items.filter((i) => i.status === 'done')
  const lossy = target === 'jpg' || target === 'webp'
  const flat = target === 'jpg' || target === 'bmp' || target === 'tiff'

  const downloadAll = async () => {
    setZipping(true)
    const used = new Set()
    const files = done.map((d) => {
      let name = d.outName
      for (let n = 2; used.has(name); n++) name = d.outName.replace(/(\.[^.]+)$/, `-${n}$1`)
      used.add(name)
      return { name, blob: d.blob }
    })
    downloadBlob(await zipBlobs(files), `converted-${FORMATS[target].ext}.zip`)
    setZipping(false)
  }

  return (
    <div className="tp-stack">
      <FileDrop
        multiple
        accept={config.from}
        onFiles={onFiles}
        compact={items.length > 0}
        label={`Drop ${config.fromLabel} files here or click to choose`}
        hint={config.note ?? 'You can convert several files at once.'}
      />
      <div className="tp-panel tp-inline">
        {config.to === null && (
          <Select
            label="Convert to"
            value={target}
            onChange={setTarget}
            options={['png', 'jpg', 'webp'].map((f) => ({ value: f, label: FORMATS[f].label }))}
          />
        )}
        {lossy && <Range label="Quality" value={quality} onChange={setQuality} min={30} max={100} unit="%" />}
        {flat && <ColorField label="Background for transparent areas" value={bg} onChange={setBg} />}
        {target === 'ico' && (
          <fieldset className="tp-fieldset">
            <legend>Icon sizes</legend>
            {ICO_SIZES.map((s) => (
              <Toggle
                key={s}
                label={`${s}px`}
                checked={icoSizes.includes(s)}
                onChange={(on) => setIcoSizes((cur) => (on ? [...cur, s].sort((a, b) => a - b) : cur.filter((x) => x !== s)))}
              />
            ))}
          </fieldset>
        )}
        {config.to !== null && (
          <p className="tp-meta">
            {config.fromLabel} → {FORMATS[target].label}
          </p>
        )}
      </div>
      {target === 'ico' && !icoSizes.length && <Notice>Pick at least one icon size.</Notice>}
      {items.length > 0 && (
        <>
          <ul className="tp-files">
            {items.map((it) => (
              <Row key={it.id} item={it} onRemove={remove} />
            ))}
          </ul>
          {done.length > 1 && (
            <div className="tp-row">
              <Button onClick={downloadAll} disabled={zipping} icon={<TbDownload aria-hidden="true" />}>
                {zipping ? 'Zipping…' : `Download all (${done.length}) as ZIP`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
