// Shared image helpers for the Free Tools. Everything runs in the browser: files are decoded
// onto a <canvas>, edited there, and encoded back to a Blob for download. Nothing is uploaded.

export const FORMATS = {
  png: { mime: 'image/png', ext: 'png', label: 'PNG' },
  jpg: { mime: 'image/jpeg', ext: 'jpg', label: 'JPG' },
  webp: { mime: 'image/webp', ext: 'webp', label: 'WebP' },
  bmp: { mime: 'image/bmp', ext: 'bmp', label: 'BMP' },
  tiff: { mime: 'image/tiff', ext: 'tiff', label: 'TIFF' },
  ico: { mime: 'image/x-icon', ext: 'ico', label: 'ICO' },
}

const extOf = (name = '') => (name.includes('.') ? name.split('.').pop().toLowerCase() : '')
export const baseName = (name = 'image') => name.replace(/\.[^.]+$/, '') || 'image'

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  return canvas
}

const ctxOf = (canvas) => canvas.getContext('2d', { willReadFrequently: true })

// ---------- decoding ----------

function imageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('This file could not be read as an image.'))
    img.src = url
  })
}

async function decodeRaster(blob) {
  let source
  try {
    source = await createImageBitmap(blob)
  } catch {
    const url = URL.createObjectURL(blob)
    try {
      source = await imageFromUrl(url)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  const width = source.width || source.naturalWidth
  const height = source.height || source.naturalHeight
  const canvas = makeCanvas(width, height)
  ctxOf(canvas).drawImage(source, 0, 0)
  source.close?.()
  return canvas
}

async function decodeSvg(file) {
  const text = await file.text()
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const svg = doc.documentElement
  if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) {
    throw new Error('This SVG file could not be read.')
  }
  const num = (v) => (v && !v.includes('%') ? parseFloat(v) : NaN)
  let width = num(svg.getAttribute('width'))
  let height = num(svg.getAttribute('height'))
  const box = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number)
  if (box.length === 4 && box.every(Number.isFinite)) {
    if (!(width > 0) && !(height > 0)) [width, height] = [box[2], box[3]]
    else if (!(width > 0)) width = (height * box[2]) / box[3]
    else if (!(height > 0)) height = (width * box[3]) / box[2]
  }
  if (!(width > 0)) width = 512
  if (!(height > 0)) height = 512
  // Small vector art is rendered larger so the raster is crisp.
  const scale = Math.min(4, Math.max(1, 1024 / Math.max(width, height)))
  svg.setAttribute('width', String(width * scale))
  svg.setAttribute('height', String(height * scale))
  const markup = new XMLSerializer().serializeToString(svg)
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }))
  try {
    const img = await imageFromUrl(url)
    const canvas = makeCanvas(width * scale, height * scale)
    ctxOf(canvas).drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function decodeTiff(file) {
  const mod = await import('utif')
  const UTIF = mod.default ?? mod
  const buffer = await file.arrayBuffer()
  const pages = UTIF.decode(buffer)
  if (!pages.length) throw new Error('This TIFF file has no readable image.')
  UTIF.decodeImage(buffer, pages[0])
  const rgba = UTIF.toRGBA8(pages[0])
  const canvas = makeCanvas(pages[0].width, pages[0].height)
  ctxOf(canvas).putImageData(new ImageData(new Uint8ClampedArray(rgba), pages[0].width, pages[0].height), 0, 0)
  return canvas
}

async function decodeHeic(file) {
  const { default: heic2any } = await import('heic2any')
  let out
  try {
    out = await heic2any({ blob: file, toType: 'image/png' })
  } catch {
    throw new Error('This HEIC file could not be converted. It may be damaged or use an unsupported variant.')
  }
  return decodeRaster(Array.isArray(out) ? out[0] : out)
}

// ICO files hold one or more images. Browsers can usually draw them directly; if not, the
// biggest embedded PNG is pulled out by hand.
async function decodeIco(file) {
  try {
    return await decodeRaster(file)
  } catch {
    const view = new DataView(await file.arrayBuffer())
    const count = view.getUint16(4, true)
    let best = null
    for (let i = 0; i < count; i++) {
      const o = 6 + i * 16
      const size = view.getUint32(o + 8, true)
      const offset = view.getUint32(o + 12, true)
      const isPng = view.getUint32(offset, false) === 0x89504e47
      const w = view.getUint8(o) || 256
      if (isPng && (!best || w > best.w)) best = { w, offset, size }
    }
    if (!best) throw new Error('This ICO file could not be read.')
    return decodeRaster(new Blob([file.slice(best.offset, best.offset + best.size)], { type: 'image/png' }))
  }
}

// Loads any supported image file onto a canvas.
export async function loadImage(file) {
  const ext = extOf(file.name)
  const type = file.type
  let canvas
  if (ext === 'heic' || ext === 'heif' || /hei[cf]/.test(type)) canvas = await decodeHeic(file)
  else if (ext === 'tif' || ext === 'tiff' || type === 'image/tiff') canvas = await decodeTiff(file)
  else if (ext === 'svg' || type === 'image/svg+xml') canvas = await decodeSvg(file)
  else if (ext === 'ico' || type === 'image/x-icon' || type === 'image/vnd.microsoft.icon') canvas = await decodeIco(file)
  else canvas = await decodeRaster(file)
  return { canvas, name: file.name, size: file.size, type }
}

// ---------- canvas operations ----------

export function cloneCanvas(src) {
  const out = makeCanvas(src.width, src.height)
  ctxOf(out).drawImage(src, 0, 0)
  return out
}

// High-quality resize: big reductions are done in halving steps so detail isn't lost.
export function resample(src, width, height) {
  width = Math.max(1, Math.round(width))
  height = Math.max(1, Math.round(height))
  let current = src
  while (current.width / 2 > width && current.height / 2 > height) {
    const step = makeCanvas(Math.ceil(current.width / 2), Math.ceil(current.height / 2))
    const c = ctxOf(step)
    c.imageSmoothingQuality = 'high'
    c.drawImage(current, 0, 0, step.width, step.height)
    current = step
  }
  const out = makeCanvas(width, height)
  const c = ctxOf(out)
  c.imageSmoothingQuality = 'high'
  c.drawImage(current, 0, 0, width, height)
  return out
}

// Draws `src` into a w×h canvas. 'cover' fills and crops (focus picks which part stays);
// 'contain' fits inside and pads with `background`.
export function fitCanvas(src, width, height, { mode = 'cover', focusX = 0.5, focusY = 0.5, background = null } = {}) {
  const out = makeCanvas(width, height)
  const c = ctxOf(out)
  if (background) {
    c.fillStyle = background
    c.fillRect(0, 0, out.width, out.height)
  }
  const scale = (mode === 'cover' ? Math.max : Math.min)(out.width / src.width, out.height / src.height)
  const w = src.width * scale
  const h = src.height * scale
  const prepared = scale < 0.5 ? resample(src, w, h) : src
  c.imageSmoothingQuality = 'high'
  c.drawImage(prepared, (out.width - w) * focusX, (out.height - h) * focusY, w, h)
  return out
}

// Puts the image on a solid background (JPG, BMP and TIFF have no transparency).
export function flatten(src, background = '#ffffff') {
  const out = makeCanvas(src.width, src.height)
  const c = ctxOf(out)
  c.fillStyle = background
  c.fillRect(0, 0, out.width, out.height)
  c.drawImage(src, 0, 0)
  return out
}

export const getPixels = (canvas) => ctxOf(canvas).getImageData(0, 0, canvas.width, canvas.height)

// ---------- encoding ----------

function toBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(`This browser can't save ${mime} images.`))),
      mime,
      quality,
    )
  })
}

function encodeBmp(canvas) {
  const { width: w, height: h } = canvas
  const { data } = getPixels(canvas)
  const row = Math.ceil((w * 3) / 4) * 4
  const size = 54 + row * h
  const buffer = new ArrayBuffer(size)
  const v = new DataView(buffer)
  v.setUint16(0, 0x4d42, true)
  v.setUint32(2, size, true)
  v.setUint32(10, 54, true)
  v.setUint32(14, 40, true)
  v.setInt32(18, w, true)
  v.setInt32(22, h, true)
  v.setUint16(26, 1, true)
  v.setUint16(28, 24, true)
  v.setUint32(34, row * h, true)
  v.setInt32(38, 2835, true)
  v.setInt32(42, 2835, true)
  const px = new Uint8Array(buffer, 54)
  for (let y = 0; y < h; y++) {
    const dst = (h - 1 - y) * row
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      px[dst + x * 3] = data[i + 2]
      px[dst + x * 3 + 1] = data[i + 1]
      px[dst + x * 3 + 2] = data[i]
    }
  }
  return new Blob([buffer], { type: 'image/bmp' })
}

// Uncompressed 8-bit RGB TIFF.
function encodeTiff(canvas) {
  const { width: w, height: h } = canvas
  const { data } = getPixels(canvas)
  const entries = 9
  const ifdSize = 2 + entries * 12 + 4
  const bitsOffset = 8 + ifdSize
  const pixelOffset = bitsOffset + 6
  const byteCount = w * h * 3
  const buffer = new ArrayBuffer(pixelOffset + byteCount)
  const v = new DataView(buffer)
  v.setUint16(0, 0x4949, true)
  v.setUint16(2, 42, true)
  v.setUint32(4, 8, true)
  v.setUint16(8, entries, true)
  let o = 10
  const entry = (tag, type, count, value) => {
    v.setUint16(o, tag, true)
    v.setUint16(o + 2, type, true)
    v.setUint32(o + 4, count, true)
    if (type === 3 && count === 1) v.setUint16(o + 8, value, true)
    else v.setUint32(o + 8, value, true)
    o += 12
  }
  entry(256, 4, 1, w)
  entry(257, 4, 1, h)
  entry(258, 3, 3, bitsOffset)
  entry(259, 3, 1, 1)
  entry(262, 3, 1, 2)
  entry(273, 4, 1, pixelOffset)
  entry(277, 3, 1, 3)
  entry(278, 4, 1, h)
  entry(279, 4, 1, byteCount)
  v.setUint32(o, 0, true)
  for (let i = 0; i < 3; i++) v.setUint16(bitsOffset + i * 2, 8, true)
  const px = new Uint8Array(buffer, pixelOffset)
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    px[j] = data[i]
    px[j + 1] = data[i + 1]
    px[j + 2] = data[i + 2]
  }
  return new Blob([buffer], { type: 'image/tiff' })
}

// ICO with one PNG-compressed image per size. Sources are squared by centre-cropping.
export async function encodeIco(canvas, sizes = [16, 32, 48, 64, 128, 256]) {
  const list = [...sizes].sort((a, b) => a - b)
  const side = Math.min(canvas.width, canvas.height)
  const square = makeCanvas(side, side)
  ctxOf(square).drawImage(canvas, (side - canvas.width) / 2, (side - canvas.height) / 2)
  const pngs = []
  for (const s of list) pngs.push(new Uint8Array(await (await toBlob(resample(square, s, s), 'image/png')).arrayBuffer()))
  const header = 6 + list.length * 16
  const total = header + pngs.reduce((sum, p) => sum + p.length, 0)
  const buffer = new ArrayBuffer(total)
  const v = new DataView(buffer)
  v.setUint16(2, 1, true)
  v.setUint16(4, list.length, true)
  let offset = header
  list.forEach((s, i) => {
    const o = 6 + i * 16
    v.setUint8(o, s >= 256 ? 0 : s)
    v.setUint8(o + 1, s >= 256 ? 0 : s)
    v.setUint16(o + 4, 1, true)
    v.setUint16(o + 6, 32, true)
    v.setUint32(o + 8, pngs[i].length, true)
    v.setUint32(o + 12, offset, true)
    new Uint8Array(buffer, offset, pngs[i].length).set(pngs[i])
    offset += pngs[i].length
  })
  return new Blob([buffer], { type: 'image/x-icon' })
}

// Encodes a canvas in any supported format. Formats without transparency are flattened onto
// `background` first.
export async function encodeCanvas(canvas, format, { quality = 0.92, background = '#ffffff', icoSizes } = {}) {
  if (format === 'ico') return encodeIco(canvas, icoSizes)
  if (format === 'jpg') return toBlob(flatten(canvas, background), 'image/jpeg', quality)
  if (format === 'bmp') return encodeBmp(flatten(canvas, background))
  if (format === 'tiff') return encodeTiff(flatten(canvas, background))
  if (format === 'webp') return toBlob(canvas, 'image/webp', quality)
  return toBlob(canvas, 'image/png')
}

// ---------- downloads ----------

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function zipBlobs(files) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  files.forEach(({ name, blob }) => zip.file(name, blob))
  return zip.generateAsync({ type: 'blob' })
}

export const sourceFormat = (file) => {
  const ext = extOf(file.name)
  if (ext === 'jpg' || ext === 'jpeg' || file.type === 'image/jpeg') return 'jpg'
  if (ext === 'webp' || file.type === 'image/webp') return 'webp'
  return 'png'
}
