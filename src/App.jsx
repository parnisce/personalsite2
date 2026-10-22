import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { FiArrowLeft, FiArrowRight, FiArrowUpRight, FiCalendar, FiMapPin, FiMousePointer } from 'react-icons/fi'
import { FaLinkedinIn } from 'react-icons/fa6'
import { RiDoubleQuotesL } from 'react-icons/ri'
import heroBg from './assets/hero-bg.webp'
import { HeroStatus, RotatingLine, Ticker } from './components/HeroExtras'
import ContactForm from './components/ContactForm'
import FallbackLogo from './components/FallbackLogo'
import { Footer, Header } from './components/SiteChrome'
import SplitText from './components/SplitText'
import {
  ABOUT_LINKS,
  ABOUT_PILLARS,
  BOOKING_URL,
  CONTACT,
  LINKEDIN_RECOMMENDATIONS_URL,
  PROJECTS,
  SERVICES,
  STACK,
  TESTIMONIALS,
} from './data'
import { anchorToHands, logoState, MOBILE_BREAKPOINT, startLogoMotion } from './three/logoPath'
import { scrollToTarget, setSmoothScroll } from './lib/smoothScroll'
import './App.css'

gsap.registerPlugin(ScrollTrigger)

const LogoScene = lazy(() => import('./three/LogoScene'))

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
const MOBILE = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

// Subscribes to a media query; only re-renders when the query's answer changes.
function useMedia(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

function SectionLabel({ index, label }) {
  return (
    <div className="section-label" aria-hidden="true">
      <span className="section-num">{String(index).padStart(2, '0')}</span>
      <span className="section-name">{label}</span>
      <span className="section-line" />
      <span className="section-dots">
        <i />
        <i />
        <i />
      </span>
    </div>
  )
}

function Hero({ reduced }) {
  const photo = useRef(null)

  // Keep the logo locked to the hands in the photo whenever the layout changes.
  useEffect(() => {
    const img = photo.current
    const update = () => anchorToHands(img)
    if (img.complete) update()
    img.addEventListener('load', update)
    const observer = new ResizeObserver(update)
    observer.observe(img)
    return () => {
      img.removeEventListener('load', update)
      observer.disconnect()
    }
  }, [])

  return (
    <section id="hero" className="section hero">
      <div className="section-bg hero-bg">
        <img ref={photo} className="hero-photo" src={heroBg} alt="" fetchPriority="high" />
      </div>
      <div className="shell hero-grid">
        <div className="hero-copy">
          <HeroStatus />
          <h1 className="hero-title">
            {reduced ? (
              <>
                <span>I BUILD.</span>
                <span>I DESIGN.</span>
                <RotatingLine reduced />
              </>
            ) : (
              <>
                <SplitText tag="span" text="I BUILD." textAlign="left" delay={40} mask />
                <SplitText tag="span" text="I DESIGN." textAlign="left" delay={40} mask />
                <RotatingLine />
              </>
            )}
          </h1>
          <p className="lead hero-in">
            I build high-performance websites, connect powerful tools, and automate business workflows that turn more
            visitors into customers.
          </p>
          <div className="actions hero-in">
            <a href="#portfolio" className="btn btn-primary">
              Explore my work <FiArrowRight />
            </a>
            <a href="#contact" className="btn btn-ghost">
              Start a conversation
            </a>
          </div>
          <a href="#about" className="scroll-hint hero-in">
            <FiMousePointer /> Scroll to explore
          </a>
        </div>
      </div>
      <Ticker />
      <div className="hero-index" aria-hidden="true">
        <span className="section-num">01</span>
        <span className="section-name">Hero</span>
        <span className="section-line" />
      </div>
    </section>
  )
}

function About() {
  return (
    <section id="about" className="section about">
      <div className="section-bg about-bg" />
      <div className="shell split split-right about-grid">
        <div className="logo-slot" />
        <div className="about-copy">
          <p className="about-eyebrow reveal">
            <b>02</b>
            <i>/</i>
            About
          </p>
          <h2 className="h2 reveal">
            From digital ideas
            <br />
            <span className="accent">to systems that deliver.</span>
          </h2>
          <p className="about-text reveal">
            I&apos;m <b>Cyryl Bitangcol</b>, a web developer from the Philippines with over a decade of experience
            building websites for agencies, consultancies, and founders. Today, I combine modern web development,
            interface design, and intelligent automation to create fast, custom digital experiences that connect with
            customers and help businesses grow.
          </p>
          <p className="about-text reveal">
            Using Next.js, Supabase, and GoHighLevel, I build websites, lead generation funnels, automated workflows,
            and AI-powered customer experiences that reduce repetitive work and turn more opportunities into results.
          </p>
          <div className="about-links reveal">
            {ABOUT_LINKS.map(({ label, href, internal }) => (
              <a key={label} href={href} {...(internal ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>
                {label} <FiArrowUpRight aria-hidden="true" />
              </a>
            ))}
            <span className="about-rule" aria-hidden="true" />
          </div>
        </div>
      </div>
      <div className="about-cards-wrap">
        <div className="about-cards">
          {ABOUT_PILLARS.map(({ title, description, Icon }) => (
            <a key={title} href="#stack" className="about-card reveal-card">
              <span className="about-card-icon">
                <Icon aria-hidden="true" />
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
              <span className="about-card-foot" aria-hidden="true">
                <i />
                <FiArrowRight />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

// A browser-and-phone mock for a project: the real screenshot when the project has an `image`,
// otherwise artwork generated from its colour.
function ProjectPreview({ project }) {
  return (
    <div className="wk-preview" style={{ '--hue': project.hue }}>
      <div className="wk-glow" aria-hidden="true" />
      <div className="wk-frame">
        <div className="wk-bar" aria-hidden="true">
          <span />
          <span />
          <span />
          <em>{project.domain}</em>
        </div>
        <div className="wk-screen">
          {project.image ? (
            <img src={project.image} alt="" loading="lazy" />
          ) : (
            <div className="wk-art" aria-hidden="true">
              <b>{project.title}</b>
              <i />
              <i />
              <i />
              <span />
            </div>
          )}
        </div>
      </div>
      <div className="wk-phone" aria-hidden="true">
        <div className="wk-phone-screen">
          <b />
          <i />
          <i />
          <span />
        </div>
      </div>
    </div>
  )
}

const pad2 = (n) => String(n).padStart(2, '0')

function Portfolio() {
  const [active, setActive] = useState(0)
  const articles = useRef([])

  // The article closest to the middle of the screen decides which preview is shown on the right.
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const middle = window.innerHeight / 2
      let best = 0
      let nearest = Infinity
      articles.current.forEach((el, i) => {
        if (!el) return
        const r = el.getBoundingClientRect()
        const distance = Math.abs((r.top + r.bottom) / 2 - middle)
        if (distance < nearest) {
          nearest = distance
          best = i
        }
      })
      setActive(best)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <section id="portfolio" className="section portfolio">
      <div className="section-bg portfolio-bg" />
      <SectionLabel index={3} label="Selected Work" />
      <div className="shell">
        <div className="wk-head">
          <div>
            <p className="about-eyebrow wk-eyebrow reveal">
              <b>03</b>
              <i>/</i>
              Selected work
            </p>
            <h2 className="h2 reveal">
              The work.
              <br />
              <span className="wk-dim">The real-world impact.</span>
            </h2>
            <p className="body reveal">
              Fast Next.js sites with GoHighLevel CRM and AI workflows behind them, built for builders and service
              businesses.
            </p>
          </div>
          <p className="wk-count reveal">
            {pad2(PROJECTS.length)} {PROJECTS.length === 1 ? 'project' : 'projects'}
          </p>
        </div>

        <div className="wk-grid">
          <div className="wk-list">
            {PROJECTS.map((p, i) => {
              const [lead, ...rest] = p.description.split(/(?<=[.!?])\s+/)
              return (
                <article
                  key={p.title}
                  ref={(el) => (articles.current[i] = el)}
                  data-index={i}
                  className={`wk-item${active === i ? ' is-active' : ''}`}
                >
                  <div className="wk-inline">
                    <ProjectPreview project={p} />
                  </div>
                  <div className="wk-meta">
                    <span className="wk-n">{pad2(i + 1)}</span>
                    <span className="wk-line" />
                    <span>{p.domain}</span>
                    <span className="wk-sep">/</span>
                    <span className="wk-type">{p.tags[0]}</span>
                  </div>
                  <h3>{p.title}</h3>
                  <p className="wk-lead">{lead}</p>
                  {rest.length > 0 && <p className="wk-text">{rest.join(' ')}</p>}
                  <ul className="wk-tags">
                    {p.tags.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  <div className="wk-actions">
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                      Visit the live site <FiArrowUpRight />
                    </a>
                    <a href="#contact" className="btn btn-ghost">
                      Start a similar project
                    </a>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="wk-side" aria-hidden="true">
            <div className="wk-sticky">
              <div className="wk-stack">
                {PROJECTS.map((p, i) => (
                  <a key={p.title} href={p.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} className={`wk-slide${active === i ? ' is-active' : ''}`}>
                    <ProjectPreview project={p} />
                  </a>
                ))}
              </div>
              <div className="wk-progress">
                <span>
                  {pad2(active + 1)} / {pad2(PROJECTS.length)}
                </span>
                <div>
                  {PROJECTS.map((p, i) => (
                    <i key={p.title} className={i <= active ? 'is-on' : ''} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Testimonials() {
  const track = useRef(null)
  const hasQuotes = TESTIMONIALS.length > 0
  const scroll = (dir) => {
    const card = track.current.querySelector('.quote')
    track.current.scrollBy({ left: dir * (card.offsetWidth + 16), behavior: 'smooth' })
  }
  return (
    <section id="testimonials" className="section testimonials">
      <div className="section-bg testimonials-bg" />
      <SectionLabel index={4} label="Testimonials" />
      <div className="shell split split-right">
        <div className="logo-slot" />
        <div className="min0">
          <div className="row-between">
            <div>
              <p className="eyebrow reveal">In Their Words</p>
              <h2 className="h2 reveal">What Clients Say</h2>
              <p className="body reveal">
                Every review is a LinkedIn recommendation.{' '}
                <a className="text-link" href={LINKEDIN_RECOMMENDATIONS_URL} target="_blank" rel="noopener noreferrer">
                  Read them on LinkedIn
                </a>
              </p>
            </div>
            {TESTIMONIALS.length > 3 && (
              <div className="arrows reveal">
                <button className="round-btn" aria-label="Previous" onClick={() => scroll(-1)}>
                  <FiArrowLeft />
                </button>
                <button className="round-btn" aria-label="Next" onClick={() => scroll(1)}>
                  <FiArrowRight />
                </button>
              </div>
            )}
          </div>
          <div className="quotes" ref={track}>
            {hasQuotes
              ? TESTIMONIALS.map((t) => (
                  <figure className="quote reveal-card" key={t.name}>
                    <RiDoubleQuotesL className="quote-mark" />
                    <blockquote>{t.quote}</blockquote>
                    <figcaption>
                      <span className="avatar">{t.name[0]}</span>
                      <span>
                        <b>{t.name}</b>
                        <small>{t.role}</small>
                      </span>
                    </figcaption>
                    <span className="source">
                      <FaLinkedinIn /> LinkedIn recommendation
                    </span>
                  </figure>
                ))
              : [0, 1, 2].map((i) => (
                  <div className="quote quote-placeholder reveal-card" key={i} aria-hidden="true">
                    <RiDoubleQuotesL className="quote-mark" />
                    <span className="skeleton" />
                    <span className="skeleton" />
                    <span className="skeleton short" />
                  </div>
                ))}
          </div>
          {!hasQuotes && <p className="placeholder-note reveal">Client testimonials coming soon.</p>}
        </div>
      </div>
    </section>
  )
}

function TechStack() {
  return (
    <section id="stack" className="section stack">
      <div className="section-bg stack-bg" />
      <SectionLabel index={5} label="Services" />
      <div className="shell split split-left">
        <div>
          <p className="eyebrow reveal">How I Work</p>
          <h2 className="h2 reveal">
            Your whole online presence.
            <br />
            <span className="accent">One pair of hands.</span>
          </h2>
          <p className="body reveal">
            Website, funnels, automation and AI follow-up, handled by one person who sees the whole picture. No
            hand-offs, no chasing five freelancers, no lost leads in between.
          </p>
          <div className="services">
            {SERVICES.map(({ title, tagline, description, Icon }) => (
              <article className="service reveal-card" key={title}>
                <Icon className="service-icon" />
                <h3>{title}</h3>
                <p className="service-tagline">{tagline}</p>
                <p className="service-desc">{description}</p>
              </article>
            ))}
          </div>
          <p className="eyebrow stack-title reveal">The Stack Behind Every Build</p>
          <div className="tools">
            {STACK.map(({ name, Icon, color }) => (
              <div className="tool reveal-card" key={name}>
                <Icon style={{ color }} />
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="logo-slot" />
      </div>
    </section>
  )
}

function Contact() {
  const linkedIn = CONTACT.socials.find((x) => x.label === 'LinkedIn')?.href
  return (
    <section id="contact" className="section contact">
      <div className="section-bg contact-bg">
        <svg className="mountains" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0b1d33" stopOpacity="0" />
              <stop offset="1" stopColor="#0d2a44" />
            </linearGradient>
          </defs>
          <path d="M0 600 L0 420 L180 330 L320 400 L470 300 L620 380 L760 250 L900 120 L1020 300 L1200 230 L1200 600Z" fill="url(#sky)" />
          <path d="M0 600 L120 470 L300 520 L520 430 L700 500 L860 360 L900 300 L960 380 L1100 440 L1200 400 L1200 600Z" fill="#06101c" />
          <path className="trail" d="M600 600 C700 560 640 520 760 500 S820 440 860 400 S880 330 900 300" fill="none" />
        </svg>
      </div>
      <SectionLabel index={6} label="Contact" />
      <div className="shell contact-stack">
        <div className="contact-grid">
          <div className="contact-left">
            <p className="eyebrow reveal">Open to New Projects</p>
            <h2 className="h2 reveal">Something great starts with a hello.</h2>
            <p className="body reveal">
              Next.js websites, GoHighLevel funnels, workflows and Conversation AI. If our worlds overlap, I&apos;d love
              to hear from you.
            </p>

            <div className="contact-links">
              <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="contact-link reveal-card">
                <span className="contact-icon">
                  <FiCalendar aria-hidden="true" />
                </span>
                <span className="contact-link-text">
                  <strong>Let&apos;s connect</strong>
                  <small>Pick a time for a free discovery call</small>
                </span>
                <FiArrowUpRight aria-hidden="true" />
              </a>
              <a href={linkedIn} target="_blank" rel="noopener noreferrer" className="contact-link reveal-card">
                <span className="contact-icon">
                  <FaLinkedinIn aria-hidden="true" />
                </span>
                <span className="contact-link-text">
                  <strong>Connect on LinkedIn</strong>
                  <small>Read my recommendations first</small>
                </span>
                <FiArrowUpRight aria-hidden="true" />
              </a>
              <div className="contact-link reveal-card">
                <span className="contact-icon">
                  <FiMapPin aria-hidden="true" />
                </span>
                <span className="contact-link-text">
                  <strong>{CONTACT.location}</strong>
                  <small>{CONTACT.reach}</small>
                </span>
              </div>
            </div>

            <ul className="link-row reveal" aria-label="Social links">
              {CONTACT.socials.map(({ label, href }) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer" className="link-line">
                    {label}
                    <FiArrowUpRight aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
            <p className="contact-email reveal">
              Or email me at <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            </p>
          </div>

          <ContactForm />
        </div>
      </div>
    </section>
  )
}

export default function App() {
  const root = useRef(null)
  const [active, setActive] = useState('hero')
  const [webgl, setWebgl] = useState(hasWebGL)
  const reduced = useMedia(REDUCED_MOTION)
  const mobile = useMedia(MOBILE)
  const onContextLost = useCallback(() => setWebgl(false), [])

  useGSAP(
    () => {
      logoState.reduced = reduced
      const stopMotion = startLogoMotion()

      // Intro: the two logo pieces fly in from opposite sides and lock together.
      if (reduced) {
        gsap.set(logoState, { intro: 1, assemble: 1 })
      } else {
        gsap
          .timeline({ delay: 0.25 })
          .fromTo(logoState, { intro: 0 }, { intro: 1, duration: 1.4, ease: 'power2.out' }, 0)
          .fromTo(logoState, { assemble: 0 }, { assemble: 1, duration: 1.9, ease: 'expo.inOut' }, 0)
          .from('.hero-in', { y: 24, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.12 }, 0.3)
      }

      // Master scroll driver for the logo: each section after the hero adds 0 -> 1 as it scrolls
      // into place, so the sum is the (fractional) section index the logo travels to. The
      // triggers read live layout, so the path stays right whatever height each section ends up.
      const sections = gsap.utils.toArray('.section')
      const measure = () => {
        logoState.sectionTops = sections.map((sec) => sec.getBoundingClientRect().top + window.scrollY)
      }
      measure()
      ScrollTrigger.addEventListener('refresh', measure)
      const ease = gsap.parseEase('power2.inOut')
      const legs = []
      const track = () => {
        logoState.target = legs.reduce((sum, st) => sum + ease(st.progress), 0)
      }
      sections.slice(1).forEach((sec) =>
        legs.push(
          ScrollTrigger.create({ trigger: sec, start: 'top 85%', end: 'top 15%', onUpdate: track, onRefresh: track }),
        ),
      )

      sections.forEach((sec) =>
        ScrollTrigger.create({
          trigger: sec,
          start: 'top center',
          end: 'bottom center',
          onToggle: (self) => self.isActive && setActive(sec.id),
        }),
      )

      // The header settles into a solid bar once the page has scrolled.
      const header = document.querySelector('.header')
      ScrollTrigger.create({
        start: 60,
        end: 'max',
        onToggle: (self) => header?.classList.toggle('is-scrolled', self.isActive),
      })

      // Fonts load after first paint and can shift the layout, so measure the triggers again.
      let cancelled = false
      document.fonts?.ready.then(() => !cancelled && ScrollTrigger.refresh())

      const counters = gsap.utils.toArray('.count')
      let smooth = null
      let smoothTick = null
      let onAnchorClick = null
      if (reduced) {
        counters.forEach((el) => (el.textContent = el.dataset.to))
      } else {
        // Smooth, inertial page scrolling. GSAP's ticker drives it so ScrollTrigger and the 3D
        // logo stay in step with it. Touch scrolling stays native.
        smooth = new Lenis({ lerp: 0.1 })
        setSmoothScroll(smooth)
        smooth.on('scroll', ScrollTrigger.update)
        smoothTick = (time) => smooth.raf(time * 1000)
        // In-page links glide to their section instead of jumping.
        onAnchorClick = (e) => {
          const link = e.target.closest?.('a[href^="#"]')
          if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return
          const id = link.getAttribute('href').slice(1)
          const el = id ? document.getElementById(id) : null
          if (!el) return
          e.preventDefault()
          scrollToTarget(el)
          history.pushState(null, '', `#${id}`)
        }
        document.addEventListener('click', onAnchorClick)
        gsap.ticker.add(smoothTick)
        gsap.ticker.lagSmoothing(0)

        // Thin progress bar along the top edge.
        gsap.to('.scroll-progress', {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
        })

        // The hero copy drifts up and fades as the page leaves the hero.
        gsap.to('.hero-grid', {
          yPercent: -12,
          opacity: 0,
          ease: 'none',
          scrollTrigger: { trigger: '#hero', start: 'top top', end: '60% top', scrub: true },
        })
        gsap.to('.hero-index', {
          opacity: 0,
          ease: 'none',
          scrollTrigger: { trigger: '#hero', start: 'top top', end: '30% top', scrub: true },
        })

        // The coloured glow behind each section slides as it passes, for a sense of depth.
        gsap.utils.toArray('.section-bg:not(.hero-bg)').forEach((bg) =>
          gsap.fromTo(
            bg,
            { '--glow': '-18%' },
            { '--glow': '18%', ease: 'none', scrollTrigger: { trigger: bg.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } },
          ),
        )

        sections.slice(1).forEach((sec) => {
          // Each section's text plays as its own timeline while the logo is arriving
          // (the logo's leg runs from 85% to 15%, so 60% lands mid-flight). The heading is
          // unmasked first, then everything else follows in sequence.
          const heading = sec.querySelector('.h2.reveal')
          const items = [...sec.querySelectorAll('.reveal')].filter((el) => el !== heading)
          const tl = gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top 60%', once: true } })
          if (heading) {
            gsap.set(heading, { opacity: 0, y: 60, clipPath: 'inset(0% 0% 105% 0%)' })
            tl.to(heading, { opacity: 1, y: 0, clipPath: 'inset(-12% -3% -12% -3%)', duration: 1.1, ease: 'expo.out' }, 0)
          }
          if (items.length) {
            gsap.set(items, { y: 36, opacity: 0 })
            tl.to(
              items,
              {
                y: 0,
                opacity: 1,
                duration: 0.9,
                ease: 'power3.out',
                stagger: 0.09,
                onComplete: () => gsap.set(items, { clearProps: 'transform' }),
              },
              heading ? 0.18 : 0,
            )
          }

          // The section number, name and rule slide in from the edge.
          const label = sec.querySelector('.section-label')
          if (label) {
            gsap.from(label.children, {
              opacity: 0,
              x: -18,
              duration: 0.9,
              ease: 'power3.out',
              stagger: 0.1,
              scrollTrigger: { trigger: sec, start: 'top 65%', once: true },
            })
          }
        })

        // Each kind of card enters its own way, as its row scrolls into view. Inline transforms
        // are cleared afterwards so the hover lift in the stylesheet still works.
        const CARD_ENTRANCES = [
          ['.project', { y: 90, scale: 0.95, rotationX: -8, transformPerspective: 900 }, 0.12],
          ['.service', { y: 56, scale: 0.96 }, 0.09],
          ['.about-card', { y: 54, scale: 0.96 }, 0.12],
          ['.tool', { y: 30, scale: 0.8 }, 0.04],
          ['.quote', { x: 70 }, 0.12],
          ['.contact-link', { x: -50 }, 0.12],
          ['.contact-form', { y: 70 }, 0],
        ]
        CARD_ENTRANCES.forEach(([selector, from, stagger]) => {
          const cards = gsap.utils.toArray(`${selector}.reveal-card`)
          if (!cards.length) return
          gsap.set(cards, { opacity: 0, ...from })
          ScrollTrigger.batch(cards, {
            start: 'top 92%',
            once: true,
            onEnter: (els) =>
              gsap.to(els, {
                opacity: 1,
                x: 0,
                y: 0,
                scale: 1,
                rotationX: 0,
                duration: 1,
                ease: 'power3.out',
                stagger,
                overwrite: true,
                onComplete: () => gsap.set(els, { clearProps: 'transform' }),
              }),
          })
        })

        counters.forEach((el) => {
          const counter = { v: 0 }
          gsap.to(counter, {
            v: Number(el.dataset.to),
            duration: 2.2,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 90%', once: true },
            onUpdate: () => (el.textContent = Math.round(counter.v)),
          })
        })
      }

      const onPointer = (e) => {
        logoState.pointerX = (e.clientX / window.innerWidth) * 2 - 1
        logoState.pointerY = (e.clientY / window.innerHeight) * 2 - 1
      }
      window.addEventListener('pointermove', onPointer)
      return () => {
        cancelled = true
        window.removeEventListener('pointermove', onPointer)
        ScrollTrigger.removeEventListener('refresh', measure)
        stopMotion()
        if (smooth) {
          document.removeEventListener('click', onAnchorClick)
          setSmoothScroll(null)
          gsap.ticker.remove(smoothTick)
          gsap.ticker.lagSmoothing(500, 33)
          smooth.destroy()
        }
      }
    },
    { scope: root, dependencies: [reduced], revertOnUpdate: true },
  )

  return (
    <div ref={root} className="app">
      <div className="scroll-progress" aria-hidden="true" />
      {webgl ? (
        <Suspense fallback={null}>
          <LogoScene mobile={mobile} onContextLost={onContextLost} />
        </Suspense>
      ) : (
        <FallbackLogo />
      )}
      <Header active={active} />
      <main>
        <Hero reduced={reduced} />
        <About />
        <Portfolio />
        <Testimonials />
        <TechStack />
        <Contact />
      </main>
      <Footer />
    </div>
  )
}
