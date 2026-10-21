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
  BOOKING_URL,
  CONTACT,
  LINKEDIN_RECOMMENDATIONS_URL,
  PROJECTS,
  SERVICES,
  STACK,
  STATS,
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
      <SectionLabel index={2} label="About" />
      <div className="shell split split-right">
        <div className="logo-slot" />
        <div>
          <p className="eyebrow reveal">About Me</p>
          <h2 className="h2 reveal">
            Hi, I&apos;m
            <br />
            Cyryl <span className="accent">Bitangcol</span>
          </h2>
          <p className="subhead reveal">I connect design, code and automation.</p>
          <p className="body reveal">
            A web developer from the Philippines. For over a decade I built WordPress sites for agencies,
            consultancies and founders. It taught me what clients actually need: a site that looks right and brings
            in work.
          </p>
          <p className="body reveal">
            For the last two years I&apos;ve built on Next.js with Supabase, paired with GoHighLevel for funnels,
            workflows and Conversation AI. With AI-assisted development, you get a custom, fast site in the time a
            template used to take.
          </p>
          <div className="stats reveal">
            {STATS.map((s) => (
              <div key={s.label}>
                <strong>
                  <span className="count" data-to={s.value}>
                    0
                  </span>
                  {s.suffix}
                </strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
          <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="btn btn-ghost reveal">
            Book a discovery call <FiArrowRight />
          </a>
        </div>
      </div>
    </section>
  )
}

function Portfolio() {
  return (
    <section id="portfolio" className="section portfolio">
      <div className="section-bg portfolio-bg" />
      <SectionLabel index={3} label="Work" />
      <div className="shell">
        <div className="portfolio-head">
          <p className="eyebrow reveal">Selected Work</p>
          <h2 className="h2 reveal">The work. The real-world impact.</h2>
          <p className="body reveal">
            Fast Next.js sites with GoHighLevel CRM and AI workflows behind them, built for builders and service
            businesses.
          </p>
        </div>
        <div className="projects">
          {PROJECTS.map((p, i) => (
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              key={p.title}
              className="project reveal-card"
              style={{ '--hue': p.hue }}
            >
              <div className="project-shot">
                <div className="mock-window">
                  <span />
                  <span />
                  <span />
                  <em>{p.domain}</em>
                </div>
                <div className="mock-lines">
                  <i />
                  <i />
                  <i />
                </div>
                <b className="project-num">{String(i + 1).padStart(2, '0')}</b>
              </div>
              <div className="project-body">
                <p className="project-tags">{p.tags.join(' · ')}</p>
                <h3>{p.title}</h3>
                <p className="project-desc">{p.description}</p>
                <span className="project-link">
                  Visit the live site <FiArrowRight />
                </span>
              </div>
            </a>
          ))}
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
