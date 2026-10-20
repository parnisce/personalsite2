// Image effect tools. Each entry has the controls to show and an apply(src, params) that
// returns a new canvas. Pixel loops are written by hand so they behave the same in every browser.
import { makeCanvas, resample } from './lib/image'

const ctxOf = (c) => c.getContext('2d', { willReadFrequently: true })
const clamp = (v, lo = 0, hi = 255) => (v < lo ? lo : v > hi ? hi : v)

function mapPixels(src, fn) {
  const out = makeCanvas(src.width, src.height)
  const c = ctxOf(out)
  c.drawImage(src, 0, 0)
  const img = c.getImageData(0, 0, out.width, out.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) fn(d, i)
  c.putImageData(img, 0, 0)
  return out
}

// One box-blur pass along rows then columns, using a sliding window.
function boxBlur(data, w, h, r) {
  if (r < 1) return
  const tmp = new Uint8ClampedArray(data.length)
  const pass = (from, to, len, lines, stride, lineStride) => {
    const size = r * 2 + 1
    for (let line = 0; line < lines; line++) {
      const base = line * lineStride
      for (let ch = 0; ch < 4; ch++) {
        let sum = 0
        for (let k = -r; k <= r; k++) sum += from[base + clamp(k, 0, len - 1) * stride + ch]
        for (let i = 0; i < len; i++) {
          to[base + i * stride + ch] = sum / size
          sum += from[base + clamp(i + r + 1, 0, len - 1) * stride + ch]
          sum -= from[base + clamp(i - r, 0, len - 1) * stride + ch]
        }
      }
    }
  }
  pass(data, tmp, w, h, 4, w * 4)
  pass(tmp, data, h, w, w * 4, 4)
}

function blurCanvas(src, radius) {
  const out = makeCanvas(src.width, src.height)
  const c = ctxOf(out)
  c.drawImage(src, 0, 0)
  const img = c.getImageData(0, 0, out.width, out.height)
  // Three box passes approximate a Gaussian blur.
  const r = Math.max(1, Math.round(radius / 1.7))
  for (let i = 0; i < 3; i++) boxBlur(img.data, out.width, out.height, r)
  c.putImageData(img, 0, 0)
  return out
}

function roundedPath(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

export const EFFECTS = {
  'image-to-grayscale': {
    suffix: 'grayscale',
    controls: [{ key: 'amount', type: 'range', label: 'Amount', min: 0, max: 100, default: 100, unit: '%' }],
    apply: (src, { amount }) => {
      const a = amount / 100
      return mapPixels(src, (d, i) => {
        const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
        d[i] += (g - d[i]) * a
        d[i + 1] += (g - d[i + 1]) * a
        d[i + 2] += (g - d[i + 2]) * a
      })
    },
  },
  'sepia-filter': {
    suffix: 'sepia',
    controls: [{ key: 'amount', type: 'range', label: 'Intensity', min: 0, max: 100, default: 100, unit: '%' }],
    apply: (src, { amount }) => {
      const a = amount / 100
      return mapPixels(src, (d, i) => {
        const r = d[i]
        const g = d[i + 1]
        const b = d[i + 2]
        d[i] = clamp(r + (0.393 * r + 0.769 * g + 0.189 * b - r) * a)
        d[i + 1] = clamp(g + (0.349 * r + 0.686 * g + 0.168 * b - g) * a)
        d[i + 2] = clamp(b + (0.272 * r + 0.534 * g + 0.131 * b - b) * a)
      })
    },
  },
  'invert-colors': {
    suffix: 'inverted',
    controls: [{ key: 'amount', type: 'range', label: 'Amount', min: 0, max: 100, default: 100, unit: '%' }],
    apply: (src, { amount }) => {
      const a = amount / 100
      return mapPixels(src, (d, i) => {
        d[i] += (255 - 2 * d[i]) * a
        d[i + 1] += (255 - 2 * d[i + 1]) * a
        d[i + 2] += (255 - 2 * d[i + 2]) * a
      })
    },
  },
  'blur-image': {
    suffix: 'blurred',
    controls: [{ key: 'radius', type: 'range', label: 'Blur radius', min: 0, max: 60, default: 8, unit: 'px' }],
    apply: (src, { radius }) => (radius < 1 ? mapPixels(src, () => {}) : blurCanvas(src, radius)),
  },
  'sharpen-image': {
    suffix: 'sharpened',
    controls: [{ key: 'amount', type: 'range', label: 'Strength', min: 0, max: 300, default: 100, unit: '%' }],
    apply: (src, { amount }) => {
      const a = amount / 100
      const { width: w, height: h } = src
      const out = makeCanvas(w, h)
      const c = ctxOf(out)
      c.drawImage(src, 0, 0)
      const img = c.getImageData(0, 0, w, h)
      const from = new Uint8ClampedArray(img.data)
      const d = img.data
      const at = (x, y, ch) => from[(clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)) * 4 + ch]
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4
          for (let ch = 0; ch < 3; ch++) {
            const neighbours = at(x - 1, y, ch) + at(x + 1, y, ch) + at(x, y - 1, ch) + at(x, y + 1, ch)
            d[i + ch] = clamp(from[i + ch] * (1 + 4 * a) - neighbours * a)
          }
        }
      }
      c.putImageData(img, 0, 0)
      return out
    },
  },
  'pixelate-image': {
    suffix: 'pixelated',
    controls: [{ key: 'size', type: 'range', label: 'Block size', min: 2, max: 80, default: 12, unit: 'px' }],
    apply: (src, { size }) => {
      const small = resample(src, Math.ceil(src.width / size), Math.ceil(src.height / size))
      const out = makeCanvas(src.width, src.height)
      const c = ctxOf(out)
      c.imageSmoothingEnabled = false
      c.drawImage(small, 0, 0, small.width * size, small.height * size)
      return out
    },
  },
  'vignette-effect': {
    suffix: 'vignette',
    controls: [
      { key: 'strength', type: 'range', label: 'Darkness', min: 0, max: 100, default: 70, unit: '%' },
      { key: 'size', type: 'range', label: 'Clear centre', min: 10, max: 95, default: 45, unit: '%' },
    ],
    apply: (src, { strength, size }) => {
      const out = makeCanvas(src.width, src.height)
      const c = ctxOf(out)
      c.drawImage(src, 0, 0)
      const cx = out.width / 2
      const cy = out.height / 2
      const outer = Math.hypot(cx, cy)
      const g = c.createRadialGradient(cx, cy, outer * (size / 100) * 0.9, cx, cy, outer)
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(1, `rgba(0,0,0,${strength / 100})`)
      c.fillStyle = g
      c.fillRect(0, 0, out.width, out.height)
      return out
    },
  },
  'rounded-corners': {
    suffix: 'rounded',
    alpha: true,
    controls: [{ key: 'radius', type: 'range', label: 'Corner radius', min: 0, max: 50, default: 12, unit: '%' }],
    apply: (src, { radius }) => {
      const out = makeCanvas(src.width, src.height)
      const c = ctxOf(out)
      roundedPath(c, 0, 0, out.width, out.height, (Math.min(out.width, out.height) * radius) / 100)
      c.clip()
      c.drawImage(src, 0, 0)
      return out
    },
  },
  'circle-crop': {
    suffix: 'circle',
    alpha: true,
    controls: [
      { key: 'x', type: 'range', label: 'Move left / right', min: -100, max: 100, default: 0 },
      { key: 'y', type: 'range', label: 'Move up / down', min: -100, max: 100, default: 0 },
      { key: 'zoom', type: 'range', label: 'Zoom', min: 100, max: 300, default: 100, unit: '%' },
    ],
    apply: (src, { x, y, zoom }) => {
      const side = Math.min(src.width, src.height)
      const view = side / (zoom / 100)
      const maxX = (src.width - view) / 2
      const maxY = (src.height - view) / 2
      const sx = src.width / 2 - view / 2 + (x / 100) * maxX
      const sy = src.height / 2 - view / 2 + (y / 100) * maxY
      const out = makeCanvas(side, side)
      const c = ctxOf(out)
      c.beginPath()
      c.arc(side / 2, side / 2, side / 2, 0, Math.PI * 2)
      c.clip()
      c.imageSmoothingQuality = 'high'
      c.drawImage(src, sx, sy, view, view, 0, 0, side, side)
      return out
    },
  },
  'add-border-to-photo': {
    suffix: 'border',
    controls: [
      { key: 'width', type: 'range', label: 'Border width', min: 1, max: 200, default: 24, unit: 'px' },
      { key: 'color', type: 'color', label: 'Border colour', default: '#ffffff' },
      { key: 'expand', type: 'checkbox', label: 'Add the border around the photo (makes the image larger)', default: true },
    ],
    apply: (src, { width, color, expand }) => {
      const w = expand ? src.width + width * 2 : src.width
      const h = expand ? src.height + width * 2 : src.height
      const out = makeCanvas(w, h)
      const c = ctxOf(out)
      if (expand) {
        c.fillStyle = color
        c.fillRect(0, 0, w, h)
        c.drawImage(src, width, width)
      } else {
        c.drawImage(src, 0, 0)
        c.strokeStyle = color
        c.lineWidth = width * 2
        c.strokeRect(0, 0, w, h)
      }
      return out
    },
  },
  'rotate-image': {
    suffix: 'rotated',
    controls: [
      { key: 'angle', type: 'range', label: 'Angle', min: -180, max: 180, default: 90, unit: '°' },
      { key: 'fill', type: 'color', label: 'Fill for empty corners', default: '#ffffff', show: (v) => v.angle % 90 !== 0 },
      { key: 'transparent', type: 'checkbox', label: 'Transparent corners (PNG / WebP)', default: false, show: (v) => v.angle % 90 !== 0 },
    ],
    quickAngles: [-90, 90, 180],
    apply: (src, { angle, fill, transparent }) => {
      const rad = (angle * Math.PI) / 180
      const sin = Math.abs(Math.sin(rad))
      const cos = Math.abs(Math.cos(rad))
      const w = Math.round(src.width * cos + src.height * sin)
      const h = Math.round(src.width * sin + src.height * cos)
      const out = makeCanvas(w, h)
      const c = ctxOf(out)
      if (angle % 90 !== 0 && !transparent) {
        c.fillStyle = fill
        c.fillRect(0, 0, w, h)
      }
      c.translate(out.width / 2, out.height / 2)
      c.rotate(rad)
      c.imageSmoothingQuality = 'high'
      c.drawImage(src, -src.width / 2, -src.height / 2)
      return out
    },
  },
  'flip-image': {
    suffix: 'flipped',
    controls: [
      {
        key: 'direction',
        type: 'select',
        label: 'Mirror',
        default: 'horizontal',
        options: [
          { value: 'horizontal', label: 'Horizontally (left ↔ right)' },
          { value: 'vertical', label: 'Vertically (top ↔ bottom)' },
          { value: 'both', label: 'Both directions' },
        ],
      },
    ],
    apply: (src, { direction }) => {
      const out = makeCanvas(src.width, src.height)
      const c = ctxOf(out)
      const fx = direction !== 'vertical' ? -1 : 1
      const fy = direction !== 'horizontal' ? -1 : 1
      c.translate(fx < 0 ? out.width : 0, fy < 0 ? out.height : 0)
      c.scale(fx, fy)
      c.drawImage(src, 0, 0)
      return out
    },
  },
}
