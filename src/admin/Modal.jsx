import { useEffect, useId, useRef } from 'react'
import { TbX } from 'react-icons/tb'

// A dialog shared by every editor: focus moves in on open and back on close, Tab stays inside,
// Escape closes (asking first if there are unsaved changes) and the page behind does not scroll.
export default function Modal({ title, dirty = false, onClose, onSubmit, footer, children, size = 'md' }) {
  const dialog = useRef(null)
  const headingId = useId()

  const requestClose = () => {
    if (dirty && !window.confirm('Discard your changes?')) return
    onClose()
  }

  useEffect(() => {
    const previous = document.activeElement
    const first = dialog.current?.querySelector('[data-autofocus]') ?? dialog.current?.querySelector('input, select, textarea')
    first?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      previous?.focus?.()
    }
  }, [])

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      requestClose()
      return
    }
    if (e.key !== 'Tab') return
    const items = [...dialog.current.querySelectorAll('button, input, select, textarea, [href]')].filter((el) => !el.disabled && el.tabIndex !== -1)
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="adm-overlay" onMouseDown={(e) => e.target === e.currentTarget && requestClose()}>
      <div ref={dialog} className={`adm-modal is-${size}`} role="dialog" aria-modal="true" aria-labelledby={headingId} onKeyDown={onKeyDown}>
        <form onSubmit={onSubmit} noValidate>
          <header className="adm-modal-head">
            <h2 id={headingId}>{title}</h2>
            <button type="button" className="adm-icon-btn" aria-label="Close" onClick={requestClose}>
              <TbX aria-hidden="true" />
            </button>
          </header>
          <div className="adm-modal-body">{children}</div>
          <footer className="adm-modal-foot">{footer({ requestClose })}</footer>
        </form>
      </div>
    </div>
  )
}
