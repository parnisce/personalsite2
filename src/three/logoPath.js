import gsap from 'gsap'

// Shared, mutable state. Scroll and intro animations write it; the 3D scene (or the flat
// fallback) reads it every frame, so nothing here goes through React state.
//   target   – section index scroll says the logo belongs at (fractional while travelling)
//   p        – smoothed copy of target, advanced by startLogoMotion()
//   intro    – 0 → 1 fade/scale-in on first load
//   assemble – 0 → 1 the two pieces flying in from opposite sides and locking together
//   heroStop – replaces the first stop so the logo sits in the hands of the hero photo
//   reduced  – prefers-reduced-motion: no spins, swoops or idle float
export const logoState = {
  p: 0,
  target: 0,
  intro: 0,
  assemble: 0,
  pointerX: 0,
  pointerY: 0,
  heroStop: null,
  reduced: false,
  sectionTops: [], // document offsets of each section, refreshed by ScrollTrigger
}

// The spot just above the palms in hero-bg.webp, as fractions of the photo's width / height,
// and how tall the logo should be relative to the photo's height.
const HANDS = { x: 0.6, y: 0.69, height: 0.31 }

// Works out where the hands land on screen for an <img> using object-fit: cover, and stores
// that as the hero stop. Measured with the page scrolled to the top, where the hero is shown.
export function anchorToHands(img) {
  if (!img?.naturalWidth) return
  const rect = img.getBoundingClientRect()
  const top = rect.top + window.scrollY
  const scale = Math.max(rect.width / img.naturalWidth, rect.height / img.naturalHeight)
  const drawnW = img.naturalWidth * scale
  const drawnH = img.naturalHeight * scale
  const [posX, posY] = getComputedStyle(img)
    .objectPosition.split(' ')
    .map((v) => parseFloat(v) / 100)
  const px = rect.left + (rect.width - drawnW) * posX + HANDS.x * drawnW
  const py = top + (rect.height - drawnH) * posY + HANDS.y * drawnH
  const vw = document.documentElement.clientWidth
  const vh = window.innerHeight
  logoState.heroStop = {
    x: (px / vw) * 2 - 1,
    y: 1 - (py / vh) * 2,
    scale: (HANDS.height * drawnH) / vh,
  }
}

// Where the logo rests in each section, in screen space:
// x / y run from -1 (left / bottom) to 1 (right / top); scale is the logo's height as a share
// of the viewport height. It alternates sides and shrinks as the page goes on, then settles
// centred and facing front in Contact.
export const DESKTOP_STOPS = [
  { x: 0.36, y: -0.06, scale: 0.34, rx: 0.12, ry: -0.3, rz: 0 }, // 01 hero, right (in the hands)
  { x: -0.5, y: -0.04, scale: 0.28, rx: -0.08, ry: 0.4, rz: 0.04 }, // 02 about, left
  { x: 0.64, y: 0.38, scale: 0.23, rx: 0.15, ry: -0.5, rz: -0.08 }, // 03 portfolio, right
  { x: -0.62, y: -0.02, scale: 0.22, rx: -0.1, ry: 0.45, rz: 0.05 }, // 04 testimonials, left
  { x: 0.62, y: 0.04, scale: 0.25, rx: 0.08, ry: -0.45, rz: -0.04 }, // 05 tech stack, right
  { x: 0, y: 0.47, scale: 0.21, rx: 0, ry: 0, rz: 0 }, // 06 contact, centre, final pose
]

// Narrow screens: the logo floats above each section's text, still alternating sides.
export const MOBILE_STOPS = [
  { x: 0.05, y: 0.5, scale: 0.24, rx: 0.12, ry: -0.3, rz: 0 },
  { x: -0.32, y: 0.6, scale: 0.2, rx: -0.08, ry: 0.4, rz: 0.04 },
  { x: 0.35, y: 0.62, scale: 0.17, rx: 0.15, ry: -0.5, rz: -0.08 },
  { x: -0.35, y: 0.62, scale: 0.17, rx: -0.1, ry: 0.45, rz: 0.05 },
  { x: 0.35, y: 0.62, scale: 0.18, rx: 0.08, ry: -0.45, rz: -0.04 },
  { x: 0, y: 0.6, scale: 0.2, rx: 0, ry: 0, rz: 0 },
]

export const MOBILE_BREAKPOINT = 820

const lerp = (a, b, t) => a + (b - a) * t

// The logo's pose for the current (smoothed) scroll position. Between two stops it follows a
// curved path: an arc that bulges upward, a swoop toward the camera, and one full turn.
export function logoPose(viewportWidth) {
  const mobile = viewportWidth < MOBILE_BREAKPOINT
  const stops = mobile ? MOBILE_STOPS : DESKTOP_STOPS
  const last = stops.length - 1
  const p = Math.min(Math.max(logoState.p, 0), last)
  const i = Math.min(Math.floor(p), last - 1)
  const t = p - i
  const at = (k) => (k === 0 && logoState.heroStop ? { ...stops[0], ...logoState.heroStop } : stops[k])
  const a = at(i)
  const b = at(i + 1)
  const motion = logoState.reduced ? 0 : 1
  const travel = Math.sin(t * Math.PI) * motion // 0 at a stop, 1 mid-flight

  // On phones the logo sits above its section's text, so once that section starts scrolling
  // up, the logo scrolls with it instead of covering the text; it drops into the next section
  // as that one arrives.
  let lift = 0
  const tops = logoState.sectionTops
  if (mobile && tops.length > i + 1) {
    const scrolledPast = (k) => Math.max(0, window.scrollY - tops[k])
    lift = (lerp(scrolledPast(i), scrolledPast(i + 1), t) / window.innerHeight) * 2
  }

  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t) + travel * 0.22 + lift,
    scale: lerp(a.scale, b.scale, t) * (1 + travel * 0.06),
    rx: lerp(a.rx, b.rx, t) + travel * 0.35,
    ry: lerp(a.ry, b.ry, t) + p * Math.PI * 2 * motion,
    rz: lerp(a.rz, b.rz, t),
    travel,
  }
}

// Advances the smoothed scroll position on GSAP's ticker, so the logo glides between stops
// instead of jumping with the scrollbar. Returns a cleanup function.
export function startLogoMotion() {
  const tick = (_time, deltaMs) => {
    const k = 1 - Math.exp((-Math.min(deltaMs, 100) / 1000) * 4)
    logoState.p += (logoState.target - logoState.p) * k
  }
  gsap.ticker.add(tick)
  return () => gsap.ticker.remove(tick)
}
