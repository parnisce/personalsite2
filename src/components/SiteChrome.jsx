import { useEffect, useState } from 'react'
import { FiArrowRight, FiArrowUp, FiArrowUpRight, FiMenu, FiX } from 'react-icons/fi'
import { CONTACT, NAV } from '../data'
import { scrollToTarget } from '../lib/smoothScroll'
import LogoMark from './LogoMark'

// Header and footer shared by the home page and the Free Tools page. Section links are plain
// anchors on the home page and point back to it ("/#about") from other pages.
const YEAR = new Date().getFullYear()

const linkFor = (item, onHome) => item.href ?? (onHome ? `#${item.id}` : `/#${item.id}`)

function Brand({ onHome, size }) {
  return (
    <a href={onHome ? '#hero' : '/'} className="brand">
      <LogoMark size={size} />
      <span>
        CYRYL.<b>BITANGCOL</b>
      </span>
    </a>
  )
}

export function Header({ active, onHome = true }) {
  const [open, setOpen] = useState(false) // the menu on phones and small tablets

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    const onResize = () => window.innerWidth > 1180 && setOpen(false)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  return (
    <header className={`header${open ? ' is-menu-open' : ''}`}>
      <div className="header-inner">
        <Brand onHome={onHome} size={38} />
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => (
            <a key={n.id} href={linkFor(n, onHome)} className={active === n.id ? 'is-active' : ''}>
              {n.label}
            </a>
          ))}
        </nav>
        <a href={onHome ? '#contact' : '/#contact'} className="btn btn-ghost btn-sm">
          Let&apos;s Work Together <FiArrowRight />
        </a>
        <button type="button" className="nav-toggle" aria-label={open ? 'Close the menu' : 'Open the menu'} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)}>
          {open ? <FiX aria-hidden="true" /> : <FiMenu aria-hidden="true" />}
        </button>
      </div>
      <div id="mobile-nav" className="mobile-nav" hidden={!open}>
        <nav aria-label="Mobile">
          {NAV.map((n) => (
            <a key={n.id} href={linkFor(n, onHome)} className={active === n.id ? 'is-active' : ''} onClick={() => setOpen(false)}>
              {n.label}
            </a>
          ))}
        </nav>
        <a href={onHome ? '#contact' : '/#contact'} className="btn btn-primary" onClick={() => setOpen(false)}>
          Let&apos;s Work Together <FiArrowRight />
        </a>
      </div>
    </header>
  )
}

export function Footer({ onHome = true }) {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-row">
          <Brand onHome={onHome} size={40} />
          <div className="footer-end">
            <ul className="footer-links">
              {CONTACT.socials.map(({ label, href }) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer" className="link-line">
                    {label}
                    <FiArrowUpRight aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
            <button type="button" className="footer-top-btn" aria-label="Back to top" onClick={() => scrollToTarget(0)}>
              <FiArrowUp aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="footer-meta">
          <p>© {YEAR} Cyryl Bitangcol</p>
          <p>Build · Design · Automate · Scale</p>
          <p>Philippines · Working worldwide</p>
        </div>
      </div>
    </footer>
  )
}
