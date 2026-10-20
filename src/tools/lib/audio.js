// Audio helpers for the transcription tools: decoding a video or audio file in the browser,
// writing WAV files, and turning transcript segments into TXT / SRT / VTT.

export const SPEECH_RATE = 16000 // sample rate the speech model expects

const MAX_BYTES = 2 * 1024 ** 3

const DECODE_HELP =
  "This file's sound could not be read. It may have no audio track, or your browser may not support its format. MP4, MOV, WebM, MP3, WAV, M4A, OGG and FLAC usually work."

function makeContext(sampleRate) {
  const Ctx = window.AudioContext ?? window.webkitAudioContext
  if (!Ctx) throw new Error("This browser can't decode audio.")
  try {
    return sampleRate ? new Ctx({ sampleRate }) : new Ctx()
  } catch {
    return new Ctx()
  }
}

// Decodes the audio track of any audio or video file the browser can open.
export async function decodeMedia(file, sampleRate) {
  if (file.size > MAX_BYTES) throw new Error('This file is over 2 GB, which is too large to process in a browser tab. Try a shorter clip.')
  const data = await file.arrayBuffer()
  const ctx = makeContext(sampleRate)
  try {
    return await ctx.decodeAudioData(data)
  } catch {
    throw new Error(DECODE_HELP)
  } finally {
    ctx.close?.()
  }
}

const mixToMono = (buffer) => {
  const out = new Float32Array(buffer.length)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < out.length; i++) out[i] += data[i] / buffer.numberOfChannels
  }
  return out
}

// 16 kHz mono samples for speech recognition.
export async function decodeForSpeech(file) {
  let buffer = await decodeMedia(file, SPEECH_RATE)
  if (buffer.sampleRate !== SPEECH_RATE) {
    // Some browsers ignore the requested rate, so resample by hand.
    const offline = new OfflineAudioContext(buffer.numberOfChannels, Math.max(1, Math.ceil(buffer.duration * SPEECH_RATE)), SPEECH_RATE)
    const source = offline.createBufferSource()
    source.buffer = buffer
    source.connect(offline.destination)
    source.start()
    buffer = await offline.startRendering()
  }
  if (!buffer.length) throw new Error(DECODE_HELP)
  return { samples: mixToMono(buffer), duration: buffer.duration }
}

// 16-bit PCM WAV. `channels` is an array of Float32Array, one per channel.
export function encodeWav(channels, sampleRate) {
  const count = channels.length
  const frames = channels[0].length
  const bytes = frames * count * 2
  const buffer = new ArrayBuffer(44 + bytes)
  const v = new DataView(buffer)
  const text = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  v.setUint32(4, 36 + bytes, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, count, true)
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * count * 2, true)
  v.setUint16(32, count * 2, true)
  v.setUint16(34, 16, true)
  text(36, 'data')
  v.setUint32(40, bytes, true)
  let o = 44
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < count; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]))
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      o += 2
    }
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

// ---------------------------------------------------------------- transcript formats

export function formatTime(seconds, separator = ',') {
  const total = Math.max(0, Math.round(seconds * 1000))
  const h = Math.floor(total / 3600000)
  const m = Math.floor((total % 3600000) / 60000)
  const s = Math.floor((total % 60000) / 1000)
  const ms = total % 1000
  const p = (n, w = 2) => String(n).padStart(w, '0')
  return `${p(h)}:${p(m)}:${p(s)}${separator}${p(ms, 3)}`
}

// Short form for the on-screen list: 1:05 or 1:02:05.
export function clock(seconds) {
  const t = Math.max(0, Math.floor(seconds))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

export function toPlainText(segments, { timestamps = false } = {}) {
  return segments
    .filter((s) => s.text.trim())
    .map((s) => (timestamps ? `[${clock(s.start)}] ${s.text.trim()}` : s.text.trim()))
    .join(timestamps ? '\n' : ' ')
    .trim()
}

// Greedy word wrap into lines of at most `max` characters.
function wrapLines(text, max) {
  const lines = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > max) {
      lines.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  return lines
}

// Breaks long segments into subtitle-sized cues, sharing the time by length, and wraps each cue
// into lines. Long words are never split.
export function toCues(segments, { maxChars = 42, maxLines = 2 } = {}) {
  const cues = []
  const limit = maxChars * maxLines
  for (const seg of segments) {
    const text = seg.text.replace(/\s+/g, ' ').trim()
    if (!text) continue
    const parts = []
    let current = ''
    for (const word of text.split(' ')) {
      if (current && wrapLines(`${current} ${word}`, maxChars).length > maxLines && current.length + word.length + 1 > limit) {
        parts.push(current)
        current = word
      } else current = current ? `${current} ${word}` : word
    }
    if (current) parts.push(current)
    const total = parts.reduce((n, p) => n + p.length, 0) || 1
    let t = seg.start
    const span = Math.max(0.4, seg.end - seg.start)
    parts.forEach((part) => {
      const dur = (span * part.length) / total
      cues.push({ start: t, end: t + dur, lines: wrapLines(part, maxChars) })
      t += dur
    })
  }
  // Keep cues from overlapping each other.
  cues.forEach((c, i) => {
    if (cues[i + 1] && c.end > cues[i + 1].start) c.end = cues[i + 1].start
  })
  return cues
}

export const toSrt = (cues) => cues.map((c, i) => `${i + 1}\n${formatTime(c.start)} --> ${formatTime(c.end)}\n${c.lines.join('\n')}\n`).join('\n')

export const toVtt = (cues) =>
  `WEBVTT\n\n${cues.map((c) => `${formatTime(c.start, '.')} --> ${formatTime(c.end, '.')}\n${c.lines.join('\n')}\n`).join('\n')}`

// Languages Whisper can transcribe (values are the names the model expects).
export const LANGUAGES = [
  ['auto', 'Detect automatically'],
  ['english', 'English'],
  ['spanish', 'Spanish'],
  ['french', 'French'],
  ['german', 'German'],
  ['italian', 'Italian'],
  ['portuguese', 'Portuguese'],
  ['dutch', 'Dutch'],
  ['russian', 'Russian'],
  ['ukrainian', 'Ukrainian'],
  ['polish', 'Polish'],
  ['turkish', 'Turkish'],
  ['arabic', 'Arabic'],
  ['hebrew', 'Hebrew'],
  ['hindi', 'Hindi'],
  ['chinese', 'Chinese'],
  ['japanese', 'Japanese'],
  ['korean', 'Korean'],
  ['vietnamese', 'Vietnamese'],
  ['thai', 'Thai'],
  ['indonesian', 'Indonesian'],
  ['tagalog', 'Tagalog (Filipino)'],
  ['swedish', 'Swedish'],
  ['greek', 'Greek'],
  ['czech', 'Czech'],
].map(([value, label]) => ({ value, label }))
