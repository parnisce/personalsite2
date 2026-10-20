import { useCallback, useEffect, useRef, useState } from 'react'
import { TbDownload, TbPlayerStop, TbWaveSine } from 'react-icons/tb'
import { clock, decodeForSpeech, decodeMedia, encodeWav, LANGUAGES, toCues, toPlainText, toSrt, toVtt } from './lib/audio'
import { baseName, downloadBlob, formatBytes } from './lib/image'
import { Button, CopyButton, FileDrop, Notice, Range, Select, Toggle, useObjectUrl } from './lib/ui'

// Speech-to-text with OpenAI's Whisper model, run in the visitor's browser. The media file is
// decoded and transcribed on their device; only the model files are downloaded (once).

const MODELS = [
  { value: 'tiny', label: 'Fastest (Tiny)' },
  { value: 'base', label: 'Balanced (Base)' },
  { value: 'small', label: 'Most accurate (Small, biggest download)' },
]

const KINDS = {
  video: {
    accept: 'video/*,.mp4,.mov,.m4v,.webm,.mkv,.ogv,.avi',
    drop: 'Drop a video here or click to choose',
    hint: 'MP4, MOV and WebM work best. The video is not uploaded.',
    player: 'video',
  },
  audio: {
    accept: 'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.opus,.flac,.weba',
    drop: 'Drop an audio file here or click to choose',
    hint: 'MP3, WAV, M4A, OGG and FLAC work. The audio is not uploaded.',
    player: 'audio',
  },
  subtitles: {
    accept: 'video/*,audio/*,.mp4,.mov,.m4v,.webm,.mkv,.mp3,.wav,.m4a,.ogg,.flac',
    drop: 'Drop a video or audio file here or click to choose',
    hint: 'The file is not uploaded. Subtitles are made on your device.',
    player: 'video',
  },
}

const supportsGpu = () => typeof navigator !== 'undefined' && !!navigator.gpu

function useTranscriber() {
  const [state, setState] = useState({ phase: 'idle', download: null, progress: 0, segments: [], error: '', device: null, duration: 0 })
  const worker = useRef(null)
  const current = useRef(0)

  const stop = useCallback(() => {
    current.current++
    worker.current?.terminate()
    worker.current = null
    setState((s) => (s.phase === 'idle' || s.phase === 'done' || s.phase === 'error' ? s : { ...s, phase: 'stopped' }))
  }, [])

  const start = useCallback(
    async (file, options) => {
      stop()
      const id = ++current.current
      setState({ phase: 'decoding', download: null, progress: 0, segments: [], error: '', device: null, duration: 0 })
      let decoded
      try {
        decoded = await decodeForSpeech(file)
      } catch (e) {
        if (id === current.current) setState((s) => ({ ...s, phase: 'error', error: e.message }))
        return
      }
      if (id !== current.current) return
      const w = new Worker(new URL('./lib/transcribe.worker.js', import.meta.url), { type: 'module' })
      worker.current = w
      w.onerror = () => {
        if (id === current.current) setState((s) => ({ ...s, phase: 'error', error: 'The speech engine could not start in this browser.' }))
      }
      w.onmessage = ({ data }) => {
        if (data.id !== id) return
        if (data.type === 'stage') setState((s) => ({ ...s, phase: data.stage, device: data.device ?? s.device }))
        else if (data.type === 'download') setState((s) => ({ ...s, download: { loaded: data.loaded, total: data.total } }))
        else if (data.type === 'segments') setState((s) => ({ ...s, segments: [...s.segments, ...data.segments], progress: data.progress }))
        else if (data.type === 'done') {
          w.terminate()
          worker.current = null
          setState((s) => ({ ...s, phase: 'done', progress: 1 }))
        } else if (data.type === 'error') {
          w.terminate()
          worker.current = null
          const offline = /fetch|network|failed to load|load failed/i.test(data.message)
          setState((s) => ({
            ...s,
            phase: 'error',
            error: offline
              ? 'The speech model could not be downloaded. Check your internet connection and try again.'
              : `Transcription failed: ${data.message}`,
          }))
        }
      }
      setState((s) => ({ ...s, phase: 'loading', duration: decoded.duration }))
      w.postMessage({ type: 'transcribe', id, ...options, audio: decoded.samples }, [decoded.samples.buffer])
    },
    [stop],
  )

  useEffect(() => () => worker.current?.terminate(), [])
  const setSegments = useCallback((segments) => setState((s) => ({ ...s, segments })), [])
  return { ...state, start, stop, setSegments }
}

function Progress({ job }) {
  const { phase, download, progress, duration } = job
  if (phase === 'decoding') return <p className="tp-busy" role="status"><span className="tp-spinner" aria-hidden="true" /> Reading the sound from your file…</p>
  if (phase === 'loading') {
    const pct = download?.total ? Math.round((download.loaded / download.total) * 100) : null
    return (
      <div className="tp-progress" role="status">
        <span>
          {pct === null
            ? 'Getting the speech model ready…'
            : `Downloading the speech model (first time only): ${pct}% · ${formatBytes(download.loaded)} of ${formatBytes(download.total)}`}
        </span>
        <progress max="1" value={pct === null ? undefined : pct / 100} />
      </div>
    )
  }
  if (phase === 'transcribing') {
    return (
      <div className="tp-progress" role="status">
        <span>
          Transcribing… {Math.round(progress * 100)}%{duration ? ` of ${clock(duration)}` : ''}
        </span>
        <progress max="1" value={progress || undefined} />
      </div>
    )
  }
  return null
}

function Transcriber({ kind }) {
  const cfg = KINDS[kind]
  const [file, setFile] = useState(null)
  const [model, setModel] = useState('base')
  const [language, setLanguage] = useState('auto')
  const [translate, setTranslate] = useState(false)
  const [gpu, setGpu] = useState(supportsGpu())
  const [stamps, setStamps] = useState(false)
  const [maxChars, setMaxChars] = useState(42)
  const [maxLines, setMaxLines] = useState(2)
  const job = useTranscriber()
  const media = useRef(null)
  const url = useObjectUrl(file)
  const running = ['decoding', 'loading', 'transcribing'].includes(job.phase)
  const hasText = job.segments.length > 0

  const begin = () =>
    job.start(file, { model, language, task: translate && language !== 'english' ? 'translate' : 'transcribe', gpu })

  const seek = (t) => {
    if (!media.current) return
    media.current.currentTime = t
    media.current.play?.().catch(() => {})
  }

  const edit = (index, text) => job.setSegments(job.segments.map((s, i) => (i === index ? { ...s, text } : s)))
  const name = file ? baseName(file.name) : 'transcript'
  const cues = toCues(job.segments, { maxChars, maxLines })
  const plain = toPlainText(job.segments, { timestamps: stamps })

  return (
    <div className="tp-stack">
      <FileDrop
        accept={cfg.accept}
        onFiles={([f]) => {
          job.stop()
          setFile(f)
        }}
        compact={!!file}
        label={cfg.drop}
        hint={cfg.hint}
      />
      {file && (
        <div className="tp-workspace">
          <div className="tp-panel">
            <p className="tp-meta">
              {file.name} · {formatBytes(file.size)}
            </p>
            <Select label="Accuracy" value={model} onChange={setModel} options={MODELS} />
            <Select label="Language spoken" value={language} onChange={setLanguage} options={LANGUAGES} />
            {language !== 'english' && <Toggle label="Translate the speech into English" checked={translate} onChange={setTranslate} />}
            {supportsGpu() && <Toggle label="Use the graphics card (much faster, larger first download)" checked={gpu} onChange={setGpu} />}
            {kind === 'subtitles' && (
              <>
                <Range label="Characters per line" value={maxChars} onChange={setMaxChars} min={20} max={60} />
                <Range label="Lines per subtitle" value={maxLines} onChange={setMaxLines} min={1} max={3} />
              </>
            )}
            <div className="tp-row">
              {running ? (
                <Button variant="ghost" onClick={job.stop} icon={<TbPlayerStop aria-hidden="true" />}>
                  Stop
                </Button>
              ) : (
                <Button onClick={begin} icon={<TbWaveSine aria-hidden="true" />}>
                  {hasText || job.phase === 'stopped' ? 'Start again' : kind === 'subtitles' ? 'Create subtitles' : 'Transcribe'}
                </Button>
              )}
            </div>
            <p className="tp-hint">
              Tip: Balanced is a good start. Fastest suits clear speech; Most accurate helps with accents or noise.
              {job.device && job.phase !== 'idle' && ` Running on your ${job.device === 'webgpu' ? 'graphics card' : 'processor'}.`}
            </p>
          </div>
          <div className="tp-preview">
            {url && (cfg.player === 'video' ? (
              <video ref={media} className="tp-media" src={url} controls preload="metadata" />
            ) : (
              <audio ref={media} className="tp-audio" src={url} controls preload="metadata" />
            ))}
            <Progress job={job} />
            {job.phase === 'stopped' && <Notice kind="info">{hasText ? 'Stopped. What was transcribed so far is kept below.' : 'Stopped.'}</Notice>}
            {job.phase === 'done' && !hasText && (
              <Notice kind="info">No speech was found in this file. If it does have speech, try a more accurate setting or pick the language it is spoken in.</Notice>
            )}
            <Notice>{job.error}</Notice>
          </div>
        </div>
      )}

      {hasText && (
        <section className="tp-card tp-transcript" aria-label="Transcript">
          <div className="tp-row tp-between">
            <h2>{kind === 'subtitles' ? 'Subtitles' : 'Transcript'}</h2>
            <div className="tp-row">
              {kind === 'subtitles' ? (
                <>
                  <Button disabled={running} onClick={() => downloadBlob(new Blob([toSrt(cues)], { type: 'text/plain' }), `${name}.srt`)} icon={<TbDownload aria-hidden="true" />}>
                    .srt
                  </Button>
                  <Button variant="ghost" disabled={running} onClick={() => downloadBlob(new Blob([toVtt(cues)], { type: 'text/vtt' }), `${name}.vtt`)} icon={<TbDownload aria-hidden="true" />}>
                    .vtt
                  </Button>
                  <Button variant="ghost" disabled={running} onClick={() => downloadBlob(new Blob([toPlainText(job.segments)], { type: 'text/plain' }), `${name}.txt`)}>
                    .txt
                  </Button>
                </>
              ) : (
                <>
                  <Button disabled={running} onClick={() => downloadBlob(new Blob([plain], { type: 'text/plain' }), `${name}.txt`)} icon={<TbDownload aria-hidden="true" />}>
                    .txt
                  </Button>
                  <Button variant="ghost" disabled={running} onClick={() => downloadBlob(new Blob([toSrt(cues)], { type: 'text/plain' }), `${name}.srt`)}>
                    .srt
                  </Button>
                  <Button variant="ghost" disabled={running} onClick={() => downloadBlob(new Blob([toVtt(cues)], { type: 'text/vtt' }), `${name}.vtt`)}>
                    .vtt
                  </Button>
                </>
              )}
              <CopyButton text={plain} label="Copy text" />
            </div>
          </div>
          {kind !== 'subtitles' && <Toggle label="Include timestamps in the text file and copy" checked={stamps} onChange={setStamps} />}
          <ul className="tp-segments">
            {job.segments.map((seg, i) => (
              <li key={i} className="tp-seg">
                <button type="button" className="tp-time" onClick={() => seek(seg.start)} aria-label={`Play from ${clock(seg.start)}`}>
                  {clock(seg.start)}
                </button>
                <textarea
                  value={seg.text}
                  rows={Math.max(1, Math.ceil(seg.text.length / 80))}
                  onChange={(e) => edit(i, e.target.value)}
                  aria-label={`Text at ${clock(seg.start)}`}
                  spellCheck="true"
                />
              </li>
            ))}
          </ul>
          {kind === 'subtitles' && (
            <p className="tp-hint">
              {cues.length} subtitle{cues.length === 1 ? '' : 's'} · edit any line above and download again.
            </p>
          )}
          <p className="tp-hint">Speech recognition is not perfect. Read through the text and fix names or unusual words before you use it.</p>
        </section>
      )}
    </div>
  )
}

export const VideoTranscriber = () => <Transcriber kind="video" />
export const AudioTranscriber = () => <Transcriber kind="audio" />
export const SubtitleGenerator = () => <Transcriber kind="subtitles" />

// ---------------------------------------------------------------- Extract audio

export function ExtractAudio() {
  const [file, setFile] = useState(null)
  const [rate, setRate] = useState('original')
  const [mono, setMono] = useState(false)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const previewUrl = useObjectUrl(result?.blob ?? null)
  const run = useRef(0)

  useEffect(() => {
    if (!file) return
    const id = ++run.current
    setBusy(true)
    setError('')
    ;(async () => {
      try {
        const buffer = await decodeMedia(file, rate === 'original' ? undefined : Number(rate))
        const channels = mono
          ? [
              (() => {
                const out = new Float32Array(buffer.length)
                for (let c = 0; c < buffer.numberOfChannels; c++) {
                  const d = buffer.getChannelData(c)
                  for (let i = 0; i < out.length; i++) out[i] += d[i] / buffer.numberOfChannels
                }
                return out
              })(),
            ]
          : Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, c) => buffer.getChannelData(c))
        if (id === run.current) setResult({ blob: encodeWav(channels, buffer.sampleRate), seconds: buffer.duration, rate: buffer.sampleRate, channels: channels.length })
      } catch (e) {
        if (id === run.current) {
          setResult(null)
          setError(e.message)
        }
      } finally {
        if (id === run.current) setBusy(false)
      }
    })()
  }, [file, rate, mono])

  return (
    <div className="tp-stack">
      <FileDrop accept="video/*,audio/*,.mp4,.mov,.m4v,.webm,.mkv,.ogv" onFiles={([f]) => setFile(f)} compact={!!file} label="Drop a video here or click to choose" hint="The sound is saved as a WAV file. Nothing is uploaded." />
      {file && (
        <div className="tp-workspace">
          <div className="tp-panel">
            <p className="tp-meta">
              {file.name} · {formatBytes(file.size)}
            </p>
            <Select
              label="Sample rate"
              value={rate}
              onChange={setRate}
              options={[
                { value: 'original', label: 'Keep original quality' },
                { value: '44100', label: '44.1 kHz (CD quality)' },
                { value: '22050', label: '22.05 kHz (smaller)' },
                { value: '16000', label: '16 kHz (speech, smallest)' },
              ]}
            />
            <Toggle label="Mix down to mono (half the size)" checked={mono} onChange={setMono} />
            {result && (
              <>
                <dl className="tp-stats">
                  <div>
                    <dt>Length</dt>
                    <dd>{clock(result.seconds)}</dd>
                  </div>
                  <div>
                    <dt>WAV size</dt>
                    <dd>{formatBytes(result.blob.size)}</dd>
                  </div>
                </dl>
                <Button onClick={() => downloadBlob(result.blob, `${baseName(file.name)}.wav`)} icon={<TbDownload aria-hidden="true" />}>
                  Download WAV
                </Button>
              </>
            )}
            {busy && <p className="tp-busy" role="status"><span className="tp-spinner" aria-hidden="true" /> Extracting…</p>}
            <Notice>{error}</Notice>
          </div>
          <div className="tp-preview">{previewUrl ? <audio className="tp-audio" src={previewUrl} controls /> : <p className="tp-hint">The extracted sound will appear here.</p>}</div>
        </div>
      )}
    </div>
  )
}
