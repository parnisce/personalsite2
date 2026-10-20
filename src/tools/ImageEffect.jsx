import { useState } from 'react'
import { EFFECTS } from './effects'
import { loadImage, sourceFormat } from './lib/image'
import {
  Busy,
  Button,
  CanvasView,
  Controls,
  defaultsOf,
  FileDrop,
  Notice,
  OutputBar,
  useDebouncedEffect,
} from './lib/ui'

const IMAGE_ACCEPT = 'image/*,.heic,.heif,.tif,.tiff,.ico'

// One component powers all the single-image effect tools; `slug` picks the effect.
export default function ImageEffect({ slug }) {
  const config = EFFECTS[slug]
  const [source, setSource] = useState(null)
  const [values, setValues] = useState(() => defaultsOf(config.controls))
  const [result, setResult] = useState(null)
  const [format, setFormat] = useState('png')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onFiles = async ([file]) => {
    setLoading(true)
    setError('')
    try {
      const img = await loadImage(file)
      setSource(img)
      setFormat(config.alpha ? 'png' : sourceFormat(file))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useDebouncedEffect(() => {
    if (!source) return
    try {
      setResult(config.apply(source.canvas, values))
      setError('')
    } catch (e) {
      setError(e.message)
    }
  }, [source, values])

  return (
    <div className="tp-stack">
      <FileDrop accept={IMAGE_ACCEPT} onFiles={onFiles} compact={!!source} hint="JPG, PNG, WebP, GIF, BMP, HEIC, TIFF and more" />
      {loading && <Busy label="Opening image…" />}
      <Notice>{error}</Notice>
      {source && (
        <div className="tp-workspace">
          <div className="tp-panel">
            <Controls schema={config.controls} values={values} onChange={setValues} />
            {config.quickAngles && (
              <div className="tp-row">
                {config.quickAngles.map((a) => (
                  <Button key={a} variant="ghost" onClick={() => setValues({ ...values, angle: a })}>
                    {a > 0 ? `+${a}` : a}°
                  </Button>
                ))}
              </div>
            )}
            <OutputBar
              canvas={result}
              name={source.name}
              suffix={config.suffix}
              formats={config.alpha ? ['png', 'webp'] : ['png', 'jpg', 'webp']}
              format={format}
              onFormat={setFormat}
            />
          </div>
          <div className="tp-preview">
            <CanvasView canvas={result ?? source.canvas} />
          </div>
        </div>
      )}
    </div>
  )
}
