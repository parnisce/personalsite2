// PDF helpers: rendering (PDF.js), editing (pdf-lib) and turning Markdown / HTML into a PDF.
import { makeCanvas } from './image'

let pdfjsPromise
export function getPdfjs() {
  pdfjsPromise ??= (async () => {
    const pdfjs = await import('pdfjs-dist/build/pdf.mjs')
    const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    pdfjs.GlobalWorkerOptions.workerSrc = worker
    return pdfjs
  })()
  return pdfjsPromise
}

// Opens a PDF for rendering. Throws a readable error for protected or broken files.
export async function openPdf(buffer) {
  const pdfjs = await getPdfjs()
  try {
    // PDF.js takes ownership of the buffer it is given, so it gets a copy.
    return await pdfjs.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise
  } catch (e) {
    if (e?.name === 'PasswordException') throw new Error('This PDF is password-protected. Remove the password first, then try again.')
    throw new Error('This file could not be read as a PDF.')
  }
}

// Frees a document opened with openPdf (PDF.js 6 closes it through its loading task).
export function closePdf(doc) {
  try {
    doc?.loadingTask?.destroy?.()
  } catch {
    // Already closed.
  }
}

export async function renderPage(doc, pageNumber, scale = 1) {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const canvas = makeCanvas(viewport.width, viewport.height)
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: context, canvas, viewport }).promise
  page.cleanup()
  return canvas
}

// "1-3, 5, 8-10" -> [1,2,3,5,8,9,10], clipped to 1..max. Returns null if the text is invalid.
export function parsePageRanges(text, max) {
  const pages = new Set()
  for (const part of text.split(',').map((p) => p.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!m) return null
    const a = Number(m[1])
    const b = m[2] ? Number(m[2]) : a
    if (a < 1 || b < a) return null
    for (let n = a; n <= Math.min(b, max); n++) pages.add(n)
  }
  return [...pages].sort((x, y) => x - y)
}

// ---------------------------------------------------------------- Markdown & HTML -> blocks
// A block is { type, runs: [{ text, style }], depth?, marker? } with style normal|bold|italic|code.

const INLINE =
  /\*\*(?<b1>.+?)\*\*|__(?<b2>.+?)__|\*(?<i1>[^*\s][^*]*?)\*|(?<!\w)_(?<i2>[^_\s][^_]*?)_(?!\w)|`(?<c>[^`]+)`|(?<img>!)?\[(?<lt>[^\]]*)\]\((?<lu>[^)\s]+)[^)]*\)/g

function inlineMarkdown(text) {
  const runs = []
  let last = 0
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index), style: 'normal' })
    const g = m.groups
    if (g.b1 ?? g.b2) runs.push({ text: g.b1 ?? g.b2, style: 'bold' })
    else if (g.i1 ?? g.i2) runs.push({ text: g.i1 ?? g.i2, style: 'italic' })
    else if (g.c) runs.push({ text: g.c, style: 'code' })
    else if (g.img) runs.push({ text: g.lt || '', style: 'normal' })
    else runs.push({ text: g.lt && g.lt !== g.lu ? `${g.lt} (${g.lu})` : g.lu, style: 'normal' })
    last = m.index + m[0].length
  }
  if (last < text.length) runs.push({ text: text.slice(last), style: 'normal' })
  return runs
}

export function parseMarkdown(source) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  let para = []
  let code = null
  const flush = () => {
    if (para.length) blocks.push({ type: 'p', runs: inlineMarkdown(para.join(' ')) })
    para = []
  }
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      if (code) {
        blocks.push({ type: 'code', runs: [{ text: code.join('\n'), style: 'code' }] })
        code = null
      } else {
        flush()
        code = []
      }
      continue
    }
    if (code) {
      code.push(line)
      continue
    }
    let m
    if (!line.trim()) flush()
    else if ((m = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/))) {
      flush()
      blocks.push({ type: `h${Math.min(m[1].length, 4)}`, runs: inlineMarkdown(m[2]) })
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush()
      blocks.push({ type: 'hr', runs: [] })
    } else if ((m = line.match(/^(\s*)[-*+]\s+(.*)$/))) {
      flush()
      blocks.push({ type: 'li', depth: Math.floor(m[1].length / 2), marker: null, runs: inlineMarkdown(m[2]) })
    } else if ((m = line.match(/^(\s*)(\d+)[.)]\s+(.*)$/))) {
      flush()
      blocks.push({ type: 'li', depth: Math.floor(m[1].length / 2), marker: `${m[2]}.`, runs: inlineMarkdown(m[3]) })
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      flush()
      blocks.push({ type: 'quote', runs: inlineMarkdown(m[1]) })
    } else para.push(line.trim())
  }
  if (code) blocks.push({ type: 'code', runs: [{ text: code.join('\n'), style: 'code' }] })
  flush()
  return blocks
}

const BLOCK_TAGS = new Set(['address', 'article', 'aside', 'blockquote', 'body', 'dd', 'details', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul'])
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template', 'head', 'svg', 'iframe', 'canvas', 'video', 'audio', 'object', 'embed'])

function htmlInline(node, style, out) {
  if (node.nodeType === 3) {
    const text = node.nodeValue.replace(/\s+/g, ' ')
    if (text) out.push({ text, style })
    return
  }
  if (node.nodeType !== 1) return
  const tag = node.tagName.toLowerCase()
  if (SKIP_TAGS.has(tag)) return
  if (tag === 'br') return void out.push({ text: '\n', style })
  if (tag === 'img') return void (node.getAttribute('alt') && out.push({ text: node.getAttribute('alt'), style }))
  const next = tag === 'b' || tag === 'strong' ? 'bold' : tag === 'i' || tag === 'em' || tag === 'cite' ? 'italic' : /^(code|kbd|samp|tt)$/.test(tag) ? 'code' : style
  node.childNodes.forEach((child) => htmlInline(child, next, out))
  if (tag === 'a') {
    const href = node.getAttribute('href')
    if (href && /^https?:/i.test(href) && node.textContent.trim() !== href) out.push({ text: ` (${href})`, style })
  }
}

function tidy(runs) {
  const merged = runs.filter((r) => r.text !== '')
  if (merged.length) {
    merged[0] = { ...merged[0], text: merged[0].text.replace(/^[ \t]+/, '') }
    const last = merged.length - 1
    merged[last] = { ...merged[last], text: merged[last].text.replace(/[ \t]+$/, '') }
  }
  return merged.filter((r) => r.text !== '')
}

export function parseHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocks = []
  const push = (type, runs, extra = {}) => {
    const t = tidy(runs)
    if (t.length) blocks.push({ type, runs: t, ...extra })
  }
  const walk = (parent, ctx) => {
    let pending = []
    const flush = () => {
      push(ctx.quote ? 'quote' : 'p', pending)
      pending = []
    }
    parent.childNodes.forEach((node) => {
      const tag = node.nodeType === 1 ? node.tagName.toLowerCase() : null
      if (tag && SKIP_TAGS.has(tag)) return
      if (!tag || !BLOCK_TAGS.has(tag)) return htmlInline(node, 'normal', pending)
      flush()
      if (/^h[1-6]$/.test(tag)) {
        const runs = []
        htmlInline(node, 'normal', runs)
        push(`h${Math.min(Number(tag[1]), 4)}`, runs)
      } else if (tag === 'hr') blocks.push({ type: 'hr', runs: [] })
      else if (tag === 'pre') push('code', [{ text: node.textContent.replace(/\n$/, ''), style: 'code' }])
      else if (tag === 'ul' || tag === 'ol') listItems(node, ctx.depth ?? 0, tag === 'ol')
      else if (tag === 'tr') {
        const cells = [...node.children].map((c) => c.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean)
        push('p', [{ text: cells.join('  |  '), style: 'normal' }])
      } else if (tag === 'blockquote') walk(node, { ...ctx, quote: true })
      else if (tag === 'li') push('li', (() => { const r = []; htmlInline(node, 'normal', r); return r })(), { depth: 0, marker: null })
      else if (tag === 'p' || tag === 'dt' || tag === 'dd' || tag === 'figcaption') {
        const runs = []
        htmlInline(node, 'normal', runs)
        push(ctx.quote ? 'quote' : 'p', runs)
      } else walk(node, ctx)
    })
    flush()
  }
  const listItems = (list, depth, ordered) => {
    let n = 1
    for (const li of list.children) {
      if (li.tagName.toLowerCase() !== 'li') continue
      const runs = []
      const nested = []
      li.childNodes.forEach((c) => {
        if (c.nodeType === 1 && /^(ul|ol)$/i.test(c.tagName)) nested.push(c)
        else htmlInline(c, 'normal', runs)
      })
      push('li', runs, { depth, marker: ordered ? `${n}.` : null })
      nested.forEach((l) => listItems(l, depth + 1, l.tagName.toLowerCase() === 'ol'))
      n++
    }
  }
  walk(doc.body ?? doc.documentElement, {})
  return blocks
}

// ---------------------------------------------------------------- layout

const REPLACEMENTS = {
  '‘': "'", '’': "'", '‚': ',', '“': '"', '”': '"', '–': '-', '—': '--', '…': '...',
  ' ': ' ', '→': '->', '←': '<-', '✓': 'v', '✔': 'v', '×': 'x', '\t': '    ', '​': '',
}

export async function blocksToPdf(blocks, { pageSize = 'a4', fontSize = 11 } = {}) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const fonts = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
    code: await pdf.embedFont(StandardFonts.Courier),
  }
  const charsets = new Map()
  const safe = (text, font) => {
    if (!charsets.has(font)) charsets.set(font, new Set(font.getCharacterSet()))
    const set = charsets.get(font)
    let out = ''
    for (const ch of text) {
      const rep = REPLACEMENTS[ch] ?? ch
      for (const c of rep) out += c === '\n' || set.has(c.codePointAt(0)) ? c : '?'
    }
    return out
  }

  const [PW, PH] = pageSize === 'letter' ? [612, 792] : [595.28, 841.89]
  const M = 56
  const WIDTH = PW - M * 2
  const scale = fontSize / 11
  let page = pdf.addPage([PW, PH])
  let y = PH - M
  let atTop = true
  const ensure = (h) => {
    if (y - h < M) {
      page = pdf.addPage([PW, PH])
      y = PH - M
      atTop = true
    }
  }
  const gap = (h) => {
    if (!atTop) y -= h
  }
  const ink = rgb(0.09, 0.1, 0.13)

  const STYLES = {
    h1: { size: 22 * scale, font: 'bold', before: 16, after: 8 },
    h2: { size: 17 * scale, font: 'bold', before: 14, after: 6 },
    h3: { size: 14 * scale, font: 'bold', before: 12, after: 5 },
    h4: { size: 12 * scale, font: 'bold', before: 10, after: 4 },
    p: { size: fontSize, font: 'normal', before: 0, after: 8 },
    li: { size: fontSize, font: 'normal', before: 0, after: 4 },
    quote: { size: fontSize, font: 'italic', before: 0, after: 8, color: rgb(0.32, 0.34, 0.4) },
  }

  const fontFor = (run, base) => {
    if (run.style === 'code') return fonts.code
    if (run.style === 'bold') return base === 'italic' ? fonts.boldItalic : fonts.bold
    if (run.style === 'italic') return base === 'bold' ? fonts.boldItalic : fonts.italic
    return fonts[base]
  }

  const drawLines = (lines, { indent = 0, size, color = ink, bar = false }) => {
    for (const items of lines) {
      const lineH = Math.max(size, ...items.map((i) => i.size)) * 1.4
      ensure(lineH)
      const base = y - lineH * 0.78
      if (bar) page.drawRectangle({ x: M + indent - 10, y: y - lineH, width: 2.5, height: lineH, color: rgb(0.0, 0.78, 0.85) })
      for (const it of items) {
        if (it.text.trim() || it.font === fonts.code) page.drawText(it.text, { x: M + indent + it.x, y: base, size: it.size, font: it.font, color: it.color ?? color })
      }
      y -= lineH
      atTop = false
    }
  }

  // Wraps runs into lines of positioned words.
  const wrap = (runs, { size, base, indent }) => {
    const max = WIDTH - indent
    const lines = []
    let line = []
    let x = 0
    const newline = () => {
      while (line.length && !line[line.length - 1].text.trim()) line.pop()
      lines.push(line)
      line = []
      x = 0
    }
    for (const run of runs) {
      const font = fontFor(run, base)
      const s = run.style === 'code' ? size * 0.92 : size
      for (const part of safe(run.text, font).split(/(\n)/)) {
        if (part === '\n') {
          newline()
          continue
        }
        for (const token of part.match(/\s+|\S+/g) ?? []) {
          const isSpace = /^\s/.test(token)
          let text = isSpace ? ' ' : token
          if (isSpace && x === 0) continue
          let w = font.widthOfTextAtSize(text, s)
          if (!isSpace && x + w > max && x > 0) {
            newline()
          }
          // Very long words are split so they never run off the page.
          while (!isSpace && w > max) {
            let cut = text.length
            while (cut > 1 && font.widthOfTextAtSize(text.slice(0, cut), s) > max) cut--
            line.push({ text: text.slice(0, cut), font, size: s, x: 0 })
            newline()
            text = text.slice(cut)
            w = font.widthOfTextAtSize(text, s)
          }
          line.push({ text, font, size: s, x })
          x += w
        }
      }
    }
    if (line.length) newline()
    return lines
  }

  for (const block of blocks) {
    if (block.type === 'hr') {
      ensure(16)
      y -= 8
      page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.8, color: rgb(0.75, 0.78, 0.82) })
      y -= 8
      atTop = false
      continue
    }
    if (block.type === 'code') {
      const size = fontSize * 0.86
      const cw = fonts.code.widthOfTextAtSize('M', size)
      const perLine = Math.max(10, Math.floor((WIDTH - 12) / cw))
      const rows = []
      for (const raw of safe(block.runs.map((r) => r.text).join(''), fonts.code).split('\n')) {
        if (!raw) rows.push('')
        for (let i = 0; i < raw.length; i += perLine) rows.push(raw.slice(i, i + perLine))
      }
      gap(4)
      for (const row of rows) {
        const h = size * 1.45
        ensure(h)
        page.drawRectangle({ x: M, y: y - h, width: WIDTH, height: h, color: rgb(0.94, 0.95, 0.97) })
        page.drawText(row, { x: M + 6, y: y - h * 0.72, size, font: fonts.code, color: ink })
        y -= h
        atTop = false
      }
      y -= 8
      continue
    }
    const style = STYLES[block.type] ?? STYLES.p
    const indent = block.type === 'li' ? 20 + (block.depth ?? 0) * 18 : block.type === 'quote' ? 16 : 0
    const lines = wrap(block.runs, { size: style.size, base: style.font, indent })
    if (!lines.length) continue
    gap(style.before)
    if (block.type === 'li') {
      const marker = block.marker ?? ((block.depth ?? 0) % 2 ? '-' : '•')
      const lineH = style.size * 1.4
      ensure(lineH)
      const mFont = fonts.normal
      const text = safe(marker, mFont)
      page.drawText(text, { x: M + indent - 6 - mFont.widthOfTextAtSize(text, style.size), y: y - lineH * 0.78, size: style.size, font: mFont, color: ink })
    }
    drawLines(lines, { indent, size: style.size, color: style.color ?? ink, bar: block.type === 'quote' })
    y -= style.after
  }
  if (pdf.getPageCount() === 0 || (pdf.getPageCount() === 1 && atTop)) {
    page.drawText(' ', { x: M, y: PH - M, size: 10, font: fonts.normal })
  }
  return pdf.save()
}
