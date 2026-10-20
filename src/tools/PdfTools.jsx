import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TbArrowDown, TbArrowUp, TbDownload, TbX } from 'react-icons/tb'
import { baseName, downloadBlob, encodeCanvas, formatBytes, loadImage, resample, sourceFormat, zipBlobs } from './lib/image'
import { blocksToPdf, closePdf, openPdf, parseHtml, parseMarkdown, parsePageRanges, renderPage } from './lib/pdf'
import { Busy, Button, Field, FileDrop, Notice, Range, Select, useDebouncedEffect } from './lib/ui'

const pdfBlob = (bytes) => new Blob([bytes], { type: 'application/pdf' })
const PDF_ACCEPT = 'application/pdf,.pdf'
const IMAGE_ACCEPT = 'image/*,.heic,.heif,.tif,.tiff'

async function loadPdfLib() {
  return import('pdf-lib')
}

async function readPdf(file) {
  const { PDFDocument } = await loadPdfLib()
  const bytes = await file.arrayBuffer()
  try {
    return { bytes, doc: await PDFDocument.load(bytes) }
  } catch (e) {
    if (/encrypted/i.test(e.message)) throw new Error('This PDF is password-protected. Remove the password first, then try again.')
    throw new Error('This file could not be read as a PDF.')
  }
}

function Reorderable({ items, onMove, onRemove, render }) {
  return (
    <ul className="tp-files">
      {items.map((it, i) => (
        <li className="tp-file" key={it.id}>
          <span className="tp-order">{i + 1}</span>
          {render(it)}
          <button type="button" className="tp-icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => onMove(i, -1)}>
            <TbArrowUp aria-hidden="true" />
          </button>
          <button type="button" className="tp-icon-btn" aria-label="Move down" disabled={i === items.length - 1} onClick={() => onMove(i, 1)}>
            <TbArrowDown aria-hidden="true" />
          </button>
          <button type="button" className="tp-icon-btn" aria-label={`Remove ${it.name}`} onClick={() => onRemove(it.id)}>
            <TbX aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}

const idGen = (() => {
  let n = 0
  return () => ++n
})()

function useList() {
  const [items, setItems] = useState([])
  const move = (i, d) =>
    setItems((cur) => {
      const next = [...cur]
      ;[next[i], next[i + d]] = [next[i + d], next[i]]
      return next
    })
  const remove = (id) => setItems((cur) => cur.filter((x) => x.id !== id))
  return { items, setItems, move, remove }
}

// ---------------------------------------------------------------- Images -> PDF

const PAGE_SIZES = { a4: [595.28, 841.89], letter: [612, 792] }

export function ImagesToPdf({ accept = IMAGE_ACCEPT, label = 'images' }) {
  const { items, setItems, move, remove } = useList()
  const [size, setSize] = useState('a4')
  const [orientation, setOrientation] = useState('auto')
  const [margin, setMargin] = useState('small')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const add = async (files) => {
    setError('')
    for (const file of files) {
      try {
        const loaded = await loadImage(file)
        const thumb = resample(loaded.canvas, 96, (96 * loaded.canvas.height) / loaded.canvas.width).toDataURL('image/jpeg', 0.7)
        setItems((cur) => [...cur, { id: idGen(), name: file.name, canvas: loaded.canvas, thumb, png: sourceFormat(file) === 'png' }])
      } catch (e) {
        setError(`${file.name}: ${e.message}`)
      }
    }
  }

  const build = async () => {
    setBusy(true)
    setError('')
    try {
      const { PDFDocument } = await loadPdfLib()
      const pdf = await PDFDocument.create()
      const pad = { none: 0, small: 24, large: 54 }[margin]
      for (const it of items) {
        const c = it.canvas
        const bytes = new Uint8Array(await (await encodeCanvas(c, it.png ? 'png' : 'jpg', { quality: 0.92 })).arrayBuffer())
        const img = it.png ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
        let [pw, ph] = size === 'fit' ? [c.width * 0.75, c.height * 0.75] : PAGE_SIZES[size]
        if (size !== 'fit') {
          const landscape = orientation === 'auto' ? c.width > c.height : orientation === 'landscape'
          if (landscape !== pw > ph) [pw, ph] = [ph, pw]
        }
        const page = pdf.addPage([pw, ph])
        const inset = size === 'fit' ? 0 : pad
        const k = Math.min((pw - inset * 2) / c.width, (ph - inset * 2) / c.height)
        const w = c.width * k
        const h = c.height * k
        page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
      }
      downloadBlob(pdfBlob(await pdf.save()), `${baseName(items[0].name)}${items.length > 1 ? '-and-more' : ''}.pdf`)
    } catch (e) {
      setError(`Could not create the PDF: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tp-stack">
      <FileDrop multiple accept={accept} onFiles={add} compact={items.length > 0} label={`Drop ${label} here or click to choose`} hint="Each image becomes one page, in the order shown." />
      <Notice>{error}</Notice>
      {items.length > 0 && (
        <>
          <Reorderable
            items={items}
            onMove={move}
            onRemove={remove}
            render={(it) => (
              <>
                <span className="tp-thumb">
                  <img src={it.thumb} alt="" />
                </span>
                <span className="tp-file-main">
                  <strong title={it.name}>{it.name}</strong>
                  <small>
                    {it.canvas.width} × {it.canvas.height}px
                  </small>
                </span>
              </>
            )}
          />
          <div className="tp-panel tp-inline">
            <Select
              label="Page size"
              value={size}
              onChange={setSize}
              options={[
                { value: 'a4', label: 'A4' },
                { value: 'letter', label: 'US Letter' },
                { value: 'fit', label: 'Same size as each image' },
              ]}
            />
            {size !== 'fit' && (
              <>
                <Select
                  label="Orientation"
                  value={orientation}
                  onChange={setOrientation}
                  options={[
                    { value: 'auto', label: 'Match each image' },
                    { value: 'portrait', label: 'Portrait' },
                    { value: 'landscape', label: 'Landscape' },
                  ]}
                />
                <Select
                  label="Margin"
                  value={margin}
                  onChange={setMargin}
                  options={[
                    { value: 'none', label: 'None' },
                    { value: 'small', label: 'Small' },
                    { value: 'large', label: 'Large' },
                  ]}
                />
              </>
            )}
            <Button onClick={build} disabled={busy} icon={<TbDownload aria-hidden="true" />}>
              {busy ? 'Creating…' : `Create PDF (${items.length} page${items.length === 1 ? '' : 's'})`}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export const JpgToPdf = () => <ImagesToPdf accept="image/jpeg,.jpg,.jpeg" label="JPG images" />
export const PngToPdf = () => <ImagesToPdf accept="image/png,.png" label="PNG images" />

// ---------------------------------------------------------------- Merge PDFs

export function MergePdf() {
  const { items, setItems, move, remove } = useList()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const add = async (files) => {
    setError('')
    for (const file of files) {
      try {
        const { bytes, doc } = await readPdf(file)
        setItems((cur) => [...cur, { id: idGen(), name: file.name, bytes, pages: doc.getPageCount(), size: file.size }])
      } catch (e) {
        setError(`${file.name}: ${e.message}`)
      }
    }
  }

  const merge = async () => {
    setBusy(true)
    setError('')
    try {
      const { PDFDocument } = await loadPdfLib()
      const out = await PDFDocument.create()
      for (const it of items) {
        const src = await PDFDocument.load(it.bytes)
        const pages = await out.copyPages(src, src.getPageIndices())
        pages.forEach((p) => out.addPage(p))
      }
      downloadBlob(pdfBlob(await out.save()), 'merged.pdf')
    } catch (e) {
      setError(`Could not merge the files: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  const total = items.reduce((n, i) => n + i.pages, 0)
  return (
    <div className="tp-stack">
      <FileDrop multiple accept={PDF_ACCEPT} onFiles={add} compact={items.length > 0} label="Drop PDF files here or click to choose" hint="Add two or more, then put them in order." />
      <Notice>{error}</Notice>
      {items.length > 0 && (
        <>
          <Reorderable
            items={items}
            onMove={move}
            onRemove={remove}
            render={(it) => (
              <span className="tp-file-main">
                <strong title={it.name}>{it.name}</strong>
                <small>
                  {it.pages} page{it.pages === 1 ? '' : 's'} · {formatBytes(it.size)}
                </small>
              </span>
            )}
          />
          <div className="tp-row">
            <Button onClick={merge} disabled={busy || items.length < 2} icon={<TbDownload aria-hidden="true" />}>
              {busy ? 'Merging…' : `Merge ${items.length} files (${total} pages)`}
            </Button>
            {items.length < 2 && <span className="tp-hint">Add at least two PDFs.</span>}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Page picker (split / remove / rotate)

function Thumb({ doc, number, selected, rotate = 0, onToggle }) {
  const ref = useRef(null)
  const [canvas, setCanvas] = useState(null)
  useEffect(() => {
    const el = ref.current
    let cancelled = false
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        renderPage(doc, number, 0.35).then((c) => !cancelled && setCanvas(c)).catch(() => {})
      },
      { rootMargin: '300px' },
    )
    observer.observe(el)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [doc, number])

  const cellW = 120
  const cellH = 150
  let w = 0
  let h = 0
  if (canvas) {
    const turned = rotate % 180 !== 0
    const k = Math.min(cellW / (turned ? canvas.height : canvas.width), cellH / (turned ? canvas.width : canvas.height))
    w = canvas.width * k
    h = canvas.height * k
  }
  return (
    <button type="button" ref={ref} className={`tp-page${selected ? ' is-selected' : ''}`} aria-pressed={selected} onClick={() => onToggle(number)}>
      <span className="tp-page-box">
        {canvas ? <ThumbCanvas canvas={canvas} style={{ width: w, height: h, transform: `rotate(${rotate}deg)` }} /> : <span className="tp-spinner" aria-hidden="true" />}
      </span>
      <span className="tp-page-num">{number}</span>
    </button>
  )
}

function ThumbCanvas({ canvas, style }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    el.width = canvas.width
    el.height = canvas.height
    el.getContext('2d').drawImage(canvas, 0, 0)
  }, [canvas])
  return <canvas ref={ref} style={style} />
}

function usePdfSource() {
  const [state, setState] = useState({ file: null, bytes: null, doc: null, pages: 0 })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const docRef = useRef(null)
  const load = async ([file]) => {
    setLoading(true)
    setError('')
    try {
      const bytes = await file.arrayBuffer()
      const doc = await openPdf(bytes)
      closePdf(docRef.current)
      docRef.current = doc
      setState({ file, bytes, doc, pages: doc.numPages })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => () => closePdf(docRef.current), [])
  return { ...state, error, loading, load }
}

const MODES = {
  split: { button: 'Split', noun: 'Pick the pages to save as separate files.', none: 'Pick at least one page to save.' },
  remove: { button: 'Remove pages', noun: 'Pick the pages to delete.', none: 'Pick at least one page to remove.' },
  rotate: { button: 'Rotate pages', noun: 'Pick the pages to rotate.', none: 'Pick at least one page to rotate.' },
}

export function PdfPagesTool({ mode }) {
  const cfg = MODES[mode]
  const pdf = usePdfSource()
  const [selected, setSelected] = useState(new Set())
  const [range, setRange] = useState('')
  const [angle, setAngle] = useState('90')
  const [output, setOutput] = useState('separate')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Rotating usually means "all pages", so start with everything picked.
    setSelected(mode === 'rotate' && pdf.pages ? new Set(Array.from({ length: pdf.pages }, (_, i) => i + 1)) : new Set())
    setRange('')
  }, [pdf.doc, mode, pdf.pages])

  const toggle = useCallback((n) => setSelected((cur) => {
    const next = new Set(cur)
    if (next.has(n)) next.delete(n)
    else next.add(n)
    return next
  }), [])

  const all = () => setSelected(new Set(Array.from({ length: pdf.pages }, (_, i) => i + 1)))
  const parity = (p) => setSelected(new Set(Array.from({ length: pdf.pages }, (_, i) => i + 1).filter((n) => n % 2 === p)))
  const applyRange = (text) => {
    setRange(text)
    const pages = parsePageRanges(text, pdf.pages)
    if (pages) setSelected(new Set(pages))
  }
  const rangeBad = range.trim() !== '' && !parsePageRanges(range, pdf.pages)

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      const { PDFDocument, degrees } = await loadPdfLib()
      const src = await PDFDocument.load(pdf.bytes)
      const picked = [...selected].sort((a, b) => a - b)
      const base = baseName(pdf.file.name)
      if (mode === 'split') {
        if (output === 'single') {
          const out = await PDFDocument.create()
          ;(await out.copyPages(src, picked.map((n) => n - 1))).forEach((p) => out.addPage(p))
          downloadBlob(pdfBlob(await out.save()), `${base}-selected-pages.pdf`)
        } else {
          const files = []
          for (const n of picked) {
            const out = await PDFDocument.create()
            out.addPage((await out.copyPages(src, [n - 1]))[0])
            files.push({ name: `${base}-page-${String(n).padStart(String(pdf.pages).length, '0')}.pdf`, blob: pdfBlob(await out.save()) })
          }
          downloadBlob(await zipBlobs(files), `${base}-pages.zip`)
        }
      } else if (mode === 'remove') {
        if (picked.length >= pdf.pages) throw new Error('A PDF needs at least one page. Leave at least one page unpicked.')
        const keep = src.getPageIndices().filter((i) => !selected.has(i + 1))
        const out = await PDFDocument.create()
        ;(await out.copyPages(src, keep)).forEach((p) => out.addPage(p))
        downloadBlob(pdfBlob(await out.save()), `${base}-trimmed.pdf`)
      } else {
        picked.forEach((n) => {
          const page = src.getPage(n - 1)
          page.setRotation(degrees((page.getRotation().angle + Number(angle)) % 360))
        })
        downloadBlob(pdfBlob(await src.save()), `${base}-rotated.pdf`)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const pageList = useMemo(() => Array.from({ length: pdf.pages }, (_, i) => i + 1), [pdf.pages])
  const rotation = mode === 'rotate' ? Number(angle) : 0

  return (
    <div className="tp-stack">
      <FileDrop accept={PDF_ACCEPT} onFiles={pdf.load} compact={!!pdf.doc} label="Drop a PDF here or click to choose" />
      {pdf.loading && <Busy label="Opening PDF…" />}
      <Notice>{pdf.error}</Notice>
      {pdf.doc && (
        <>
          <div className="tp-panel tp-inline">
            <p className="tp-meta">
              {pdf.file.name} · {pdf.pages} page{pdf.pages === 1 ? '' : 's'}
            </p>
            <div className="tp-row">
              <Button variant="ghost" onClick={all}>All</Button>
              <Button variant="ghost" onClick={() => setSelected(new Set())}>None</Button>
              <Button variant="ghost" onClick={() => parity(1)}>Odd</Button>
              <Button variant="ghost" onClick={() => parity(0)}>Even</Button>
            </div>
            <Field label="Or type page numbers" hint={rangeBad ? undefined : 'For example 1-3, 5, 8-10'}>
              <input type="text" value={range} onChange={(e) => applyRange(e.target.value)} placeholder="1-3, 5, 8-10" spellCheck="false" aria-invalid={rangeBad} />
            </Field>
            {rangeBad && <Notice>That does not look like a page range. Try 1-3, 5, 8-10.</Notice>}
            {mode === 'rotate' && (
              <Select
                label="Rotate clockwise by"
                value={angle}
                onChange={setAngle}
                options={[
                  { value: '90', label: '90°' },
                  { value: '180', label: '180°' },
                  { value: '270', label: '270° (90° counter-clockwise)' },
                ]}
              />
            )}
            {mode === 'split' && (
              <Select
                label="Save as"
                value={output}
                onChange={setOutput}
                options={[
                  { value: 'separate', label: 'Separate PDFs in a ZIP' },
                  { value: 'single', label: 'One PDF with the chosen pages' },
                ]}
              />
            )}
            <Button onClick={run} disabled={busy || !selected.size} icon={<TbDownload aria-hidden="true" />}>
              {busy ? 'Working…' : `${cfg.button} (${selected.size} page${selected.size === 1 ? '' : 's'})`}
            </Button>
            {!selected.size && <span className="tp-hint">{cfg.none}</span>}
          </div>
          <Notice>{error}</Notice>
          <p className="tp-hint">{cfg.noun} Click a page to select it.</p>
          <div className="tp-pages">
            {pageList.map((n) => (
              <Thumb key={n} doc={pdf.doc} number={n} selected={selected.has(n)} rotate={selected.has(n) ? rotation : 0} onToggle={toggle} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export const PdfSplitter = () => <PdfPagesTool mode="split" />
export const PdfPageRemover = () => <PdfPagesTool mode="remove" />
export const RotatePdfPages = () => <PdfPagesTool mode="rotate" />

// ---------------------------------------------------------------- PDF -> images

export function PdfToImage() {
  const pdf = usePdfSource()
  const [dpi, setDpi] = useState('150')
  const [format, setFormat] = useState('png')
  const [range, setRange] = useState('')
  const [results, setResults] = useState([])
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const [zipping, setZipping] = useState(false)
  const run = useRef(0)

  const convert = async () => {
    const token = ++run.current
    setError('')
    setResults([])
    const pages = range.trim() ? parsePageRanges(range, pdf.pages) : Array.from({ length: pdf.pages }, (_, i) => i + 1)
    if (!pages?.length) return setError('Enter valid page numbers, like 1-3, 5.')
    try {
      const out = []
      for (const [i, n] of pages.entries()) {
        if (token !== run.current) return
        setProgress({ done: i, total: pages.length })
        const canvas = await renderPage(pdf.doc, n, Number(dpi) / 72)
        const blob = await encodeCanvas(canvas, format, { quality: 0.92 })
        out.push({ n, blob, url: URL.createObjectURL(blob), w: canvas.width, h: canvas.height })
        setResults([...out])
      }
    } catch (e) {
      setError(e.message)
    } finally {
      if (token === run.current) setProgress(null)
    }
  }

  useEffect(() => () => results.forEach((r) => URL.revokeObjectURL(r.url)), [results])

  const base = pdf.file ? baseName(pdf.file.name) : 'page'
  const pad = String(pdf.pages).length
  const ext = format === 'jpg' ? 'jpg' : 'png'
  const zip = async () => {
    setZipping(true)
    downloadBlob(await zipBlobs(results.map((r) => ({ name: `${base}-page-${String(r.n).padStart(pad, '0')}.${ext}`, blob: r.blob }))), `${base}-images.zip`)
    setZipping(false)
  }

  return (
    <div className="tp-stack">
      <FileDrop
        accept={PDF_ACCEPT}
        onFiles={(f) => {
          run.current++
          setResults([])
          pdf.load(f)
        }}
        compact={!!pdf.doc}
        label="Drop a PDF here or click to choose"
      />
      {pdf.loading && <Busy label="Opening PDF…" />}
      <Notice>{pdf.error}</Notice>
      {pdf.doc && (
        <div className="tp-panel tp-inline">
          <p className="tp-meta">
            {pdf.file.name} · {pdf.pages} page{pdf.pages === 1 ? '' : 's'}
          </p>
          <Select
            label="Quality"
            value={dpi}
            onChange={setDpi}
            options={[
              { value: '100', label: 'Small (100 DPI)' },
              { value: '150', label: 'Standard (150 DPI)' },
              { value: '200', label: 'High (200 DPI)' },
              { value: '300', label: 'Print (300 DPI)' },
            ]}
          />
          <Select label="Image type" value={format} onChange={setFormat} options={[{ value: 'png', label: 'PNG' }, { value: 'jpg', label: 'JPG (smaller)' }]} />
          <Field label="Pages (optional)" hint="Leave empty for every page">
            <input type="text" value={range} onChange={(e) => setRange(e.target.value)} placeholder="1-3, 5" spellCheck="false" />
          </Field>
          <Button onClick={convert} disabled={!!progress} icon={<TbDownload aria-hidden="true" />}>
            {progress ? 'Rendering…' : 'Convert to images'}
          </Button>
        </div>
      )}
      {progress && (
        <div className="tp-progress" role="status">
          <span>
            Rendering page {progress.done + 1} of {progress.total}
          </span>
          <progress max={progress.total} value={progress.done} />
        </div>
      )}
      <Notice>{error}</Notice>
      {results.length > 0 && (
        <>
          <div className="tp-row">
            <Button onClick={zip} disabled={zipping || !!progress} icon={<TbDownload aria-hidden="true" />}>
              {zipping ? 'Zipping…' : `Download all ${results.length} as ZIP`}
            </Button>
          </div>
          <div className="tp-results">
            {results.map((r) => (
              <figure key={r.n}>
                <img src={r.url} alt={`Page ${r.n}`} />
                <figcaption>
                  <span>
                    Page {r.n} · {formatBytes(r.blob.size)}
                  </span>
                  <button type="button" className="tp-copy" onClick={() => downloadBlob(r.blob, `${base}-page-${String(r.n).padStart(pad, '0')}.${ext}`)}>
                    <TbDownload aria-hidden="true" /> Save
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Markdown / HTML -> PDF

function PdfPreview({ bytes }) {
  const [pages, setPages] = useState([])
  useEffect(() => {
    if (!bytes) return undefined
    let cancelled = false
    let doc
    ;(async () => {
      try {
        const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
        doc = await openPdf(buffer)
        const out = []
        for (let n = 1; n <= Math.min(doc.numPages, 12); n++) {
          const canvas = await renderPage(doc, n, 1.2)
          out.push({ n, url: canvas.toDataURL('image/jpeg', 0.85) })
          if (cancelled) return
        }
        setPages(out)
      } catch {
        if (!cancelled) setPages([])
      }
    })()
    return () => {
      cancelled = true
      closePdf(doc)
    }
  }, [bytes])
  return (
    <div className="tp-pdfpreview">
      {pages.map((p) => (
        <img key={p.n} src={p.url} alt={`Page ${p.n} preview`} />
      ))}
    </div>
  )
}

const SAMPLE_MD = `# My document

Write **Markdown** on the left and the PDF updates on the right.

## A list

- Headings, paragraphs and lists
- **Bold**, *italic* and \`inline code\`
- Links like [example](https://example.com)

1. Numbered items work too
2. And so do quotes

> A short quotation, set apart from the text.

\`\`\`
const hello = "code blocks"
\`\`\`

---

That is all. Use the button to download the PDF.
`

const SAMPLE_HTML = `<h1>My document</h1>
<p>Paste <strong>HTML</strong> here and the readable text becomes a PDF.</p>
<h2>A list</h2>
<ul>
  <li>Headings, paragraphs and lists</li>
  <li><em>Italic</em> and <code>code</code></li>
</ul>
<blockquote>A short quotation.</blockquote>
`

export function TextToPdf({ kind }) {
  const isMd = kind === 'markdown'
  const [text, setText] = useState(isMd ? SAMPLE_MD : SAMPLE_HTML)
  const [pageSize, setPageSize] = useState('a4')
  const [fontSize, setFontSize] = useState(11)
  const [bytes, setBytes] = useState(null)
  const [error, setError] = useState('')
  const [name, setName] = useState('document')

  useDebouncedEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const blocks = isMd ? parseMarkdown(text) : parseHtml(text)
        const out = await blocksToPdf(blocks, { pageSize, fontSize })
        if (!cancelled) {
          setBytes(out)
          setError('')
        }
      } catch (e) {
        if (!cancelled) setError(`Could not create the PDF: ${e.message}`)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [text, pageSize, fontSize, isMd], 350)

  const onFile = async ([file]) => {
    setText(await file.text())
    setName(baseName(file.name))
  }

  return (
    <div className="tp-stack">
      <div className="tp-workspace tp-editor">
        <div className="tp-panel">
          <FileDrop
            accept={isMd ? '.md,.markdown,.txt,text/markdown,text/plain' : '.html,.htm,text/html'}
            onFiles={onFile}
            compact
            label={isMd ? 'Open a .md file' : 'Open an .html file'}
          />
          <Field label={isMd ? 'Markdown' : 'HTML'}>
            <textarea className="tp-textarea" value={text} onChange={(e) => setText(e.target.value)} spellCheck="false" rows={16} />
          </Field>
          <div className="tp-two">
            <Select label="Page size" value={pageSize} onChange={setPageSize} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'US Letter' }]} />
            <Range label="Text size" value={fontSize} onChange={setFontSize} min={9} max={16} unit="pt" />
          </div>
          <p className="tp-hint">
            {isMd ? 'Supports headings, lists, quotes, code, bold, italic and links.' : 'Scripts and styles are ignored; the readable text is kept.'} The PDF uses standard Latin
            fonts, so characters outside them (emoji, other alphabets) show as “?”.
          </p>
          <Button disabled={!bytes} onClick={() => downloadBlob(pdfBlob(bytes), `${name}.pdf`)} icon={<TbDownload aria-hidden="true" />}>
            Download PDF
          </Button>
          <Notice>{error}</Notice>
        </div>
        <div className="tp-preview">{bytes ? <PdfPreview bytes={bytes} /> : <Busy label="Building preview…" />}</div>
      </div>
    </div>
  )
}

export const MarkdownToPdf = () => <TextToPdf kind="markdown" />
export const HtmlToPdf = () => <TextToPdf kind="html" />
