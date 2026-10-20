// Runs the Whisper speech model off the main thread so the page stays responsive.
// Messages in:  { type: 'transcribe', id, model, language, task, gpu, audio: Float32Array (16 kHz mono) }
// Messages out: { type: 'stage' | 'download' | 'segments' | 'done' | 'error', id, ... }
import { env, pipeline } from '@huggingface/transformers'

env.allowLocalModels = false // models always come from the hub, then stay in the browser cache

const MODELS = {
  tiny: 'onnx-community/whisper-tiny',
  base: 'onnx-community/whisper-base',
  small: 'onnx-community/whisper-small',
}

const RATE = 16000
const post = (message) => self.postMessage(message)

let loaded = { key: null, promise: null }

function load(model, gpu, id) {
  const key = `${model}:${gpu}`
  if (loaded.key === key) return loaded.promise

  // Download progress is summed over all the model's files.
  const files = new Map()
  const progress_callback = (p) => {
    if (!p.file || !p.total) return
    if (p.status === 'progress' || p.status === 'done') files.set(p.file, { loaded: p.status === 'done' ? p.total : p.loaded, total: p.total })
    let loadedBytes = 0
    let totalBytes = 0
    files.forEach((f) => {
      loadedBytes += f.loaded
      totalBytes += f.total
    })
    post({ type: 'download', id, loaded: loadedBytes, total: totalBytes })
  }

  const build = async () => {
    if (gpu && self.navigator?.gpu) {
      try {
        if (await navigator.gpu.requestAdapter()) {
          const pipe = await pipeline('automatic-speech-recognition', MODELS[model], {
            device: 'webgpu',
            dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
            progress_callback,
          })
          return { pipe, device: 'webgpu' }
        }
      } catch {
        // Fall through to the processor-based version.
      }
    }
    const pipe = await pipeline('automatic-speech-recognition', MODELS[model], { device: 'wasm', dtype: 'q8', progress_callback })
    return { pipe, device: 'wasm' }
  }

  loaded = {
    key,
    promise: build().catch((e) => {
      loaded = { key: null, promise: null } // let the next try start fresh
      throw e
    }),
  }
  return loaded.promise
}

const rms = (a) => {
  let sum = 0
  const step = 16
  let n = 0
  for (let i = 0; i < a.length; i += step) {
    sum += a[i] * a[i]
    n++
  }
  return Math.sqrt(sum / Math.max(1, n))
}

// Cuts the audio into windows of about a minute, each ending at the quietest moment near the
// target so words aren't split in half.
function planWindows(audio, target = 60) {
  const win = RATE * target
  const block = 1600
  const cuts = [0]
  let pos = 0
  while (audio.length - pos > win * 1.15) {
    const from = pos + win - 6 * RATE
    const to = pos + win
    let best = to
    let bestEnergy = Infinity
    for (let s = from; s < to - block; s += 800) {
      let e = 0
      for (let k = 0; k < block; k += 8) e += audio[s + k] * audio[s + k]
      if (e < bestEnergy) {
        bestEnergy = e
        best = s + block / 2
      }
    }
    cuts.push(best)
    pos = best
  }
  cuts.push(audio.length)
  return cuts
}

self.onmessage = async ({ data }) => {
  if (data.type !== 'transcribe') return
  const { id, model, language, task, gpu, audio } = data
  try {
    post({ type: 'stage', id, stage: 'loading' })
    const { pipe, device } = await load(model, gpu, id)
    post({ type: 'stage', id, stage: 'transcribing', device })

    const cuts = planWindows(audio)
    const windows = cuts.length - 1
    for (let i = 0; i < windows; i++) {
      const slice = audio.subarray(cuts[i], cuts[i + 1])
      const offset = cuts[i] / RATE
      let segments = []
      // Near-silent stretches are skipped; the model tends to invent text for them.
      if (rms(slice) > 0.0015) {
        const options = { task, return_timestamps: true, chunk_length_s: 30, stride_length_s: 5 }
        if (language !== 'auto') options.language = language
        const out = await pipe(slice, options)
        const length = slice.length / RATE
        segments = (out.chunks?.length ? out.chunks : [{ text: out.text, timestamp: [0, length] }])
          .map((c) => {
            const start = c.timestamp?.[0] ?? 0
            const end = c.timestamp?.[1] ?? Math.min(length, start + 3)
            return { start: offset + start, end: offset + Math.max(end, start + 0.2), text: String(c.text ?? '').trim() }
          })
          .filter((s) => s.text)
      }
      post({ type: 'segments', id, segments, progress: (i + 1) / windows })
    }
    post({ type: 'done', id })
  } catch (e) {
    post({ type: 'error', id, message: e?.message ?? String(e) })
  }
}
