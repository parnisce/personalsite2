// Colour maths shared by the colour tools.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Accepts "#abc", "abc", "#aabbcc", "aabbcc" and 8-digit hex with alpha. Returns {r,g,b,a} or null.
export function parseHex(input) {
  const raw = String(input).trim().replace(/^#/, '')
  if (!/^[0-9a-f]+$/i.test(raw) || ![3, 4, 6, 8].includes(raw.length)) return null
  const full = raw.length <= 4 ? [...raw].map((c) => c + c).join('') : raw
  const n = (i) => parseInt(full.slice(i, i + 2), 16)
  return { r: n(0), g: n(2), b: n(4), a: full.length === 8 ? n(6) / 255 : 1 }
}

export const toHex = ({ r, g, b }) =>
  `#${[r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase()

export function rgbToHsl({ r, g, b }) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1))
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: s * 100, l: l * 100 }
}

export function hslToRgb({ h, s, l }) {
  h = ((h % 360) + 360) % 360
  s = clamp(s, 0, 100) / 100
  l = clamp(l, 0, 100) / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}

export const hslString = ({ h, s, l }) => `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`
export const rgbString = ({ r, g, b }) => `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`

// WCAG relative luminance and contrast ratio.
export function luminance({ r, g, b }) {
  const f = (v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

export function contrastRatio(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// Black or white, whichever reads better on this colour.
export const readableOn = (c) => (luminance(c) > 0.4 ? '#0b1220' : '#ffffff')

// Five-colour palettes from one starting colour.
export const SCHEMES = {
  harmony: { label: 'Balanced mix', make: (b) => [b, rot(b, 30), rot(b, 180), { ...rot(b, 180), l: clamp(b.l + 18, 12, 90) }, { ...b, l: clamp(b.l + 28, 12, 94), s: b.s * 0.6 }] },
  analogous: { label: 'Analogous (neighbours)', make: (b) => [rot(b, -40), rot(b, -20), b, rot(b, 20), rot(b, 40)] },
  complementary: { label: 'Complementary (opposites)', make: (b) => [{ ...b, l: clamp(b.l - 18, 8, 90) }, b, { ...b, l: clamp(b.l + 22, 10, 94), s: b.s * 0.7 }, rot(b, 180), { ...rot(b, 180), l: clamp(b.l - 18, 8, 90) }] },
  triadic: { label: 'Triadic (three-way)', make: (b) => [b, rot(b, 120), rot(b, 240), { ...b, l: clamp(b.l + 24, 10, 94) }, { ...rot(b, 120), l: clamp(b.l - 18, 8, 90) }] },
  split: { label: 'Split complementary', make: (b) => [b, rot(b, 150), rot(b, 210), { ...b, l: clamp(b.l + 24, 10, 94) }, { ...b, l: clamp(b.l - 20, 8, 90) }] },
  tetradic: { label: 'Tetradic (rectangle)', make: (b) => [b, rot(b, 60), rot(b, 180), rot(b, 240), { ...b, l: clamp(b.l + 26, 10, 94), s: b.s * 0.6 }] },
  monochrome: { label: 'Monochrome (shades)', make: (b) => [-30, -15, 0, 15, 30].map((d) => ({ ...b, l: clamp(b.l + d, 6, 96) })) },
}

function rot(c, deg) {
  return { ...c, h: (c.h + deg + 360) % 360 }
}
