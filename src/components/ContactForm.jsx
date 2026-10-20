import { useId, useState } from 'react'
import { FiArrowUpRight, FiCheck, FiChevronDown } from 'react-icons/fi'
import { BOOKING_URL, CONTACT, FORM_ACCESS_KEY, FORM_ENDPOINT, SERVICES } from '../data'

const INTERESTS = [...SERVICES.map((s) => s.title), 'Something else']
const EMPTY = { name: '', email: '', phone: '', interest: '', message: '' }
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// mailto: links break above roughly 2000 characters, so a very long message is trimmed there.
const MAX_BODY = 1800

// Web3Forms is used when an access key is set; any other service goes through FORM_ENDPOINT.
const ENDPOINT = FORM_ENDPOINT || (FORM_ACCESS_KEY ? 'https://api.web3forms.com/submit' : '')

function validate(v) {
  const errors = {}
  if (!v.name.trim()) errors.name = 'Please tell me your name.'
  if (!v.email.trim()) errors.email = 'Please enter your email.'
  else if (!EMAIL_PATTERN.test(v.email.trim())) errors.email = 'That email address does not look right.'
  if (!v.interest) errors.interest = 'Please choose a service.'
  if (v.message.trim().length < 10) errors.message = 'Tell me a little about your project. A sentence or two is plenty.'
  return errors
}

// Opens the visitor's email app with the enquiry written out, ready to send.
function openEmailApp(v) {
  const lines = [`Name: ${v.name.trim()}`, `Email: ${v.email.trim()}`]
  if (v.phone.trim()) lines.push(`Phone: ${v.phone.trim()}`)
  lines.push(`Interested in: ${v.interest}`, '', v.message.trim())
  const subject = encodeURIComponent(`Project enquiry from ${v.name.trim()}`)
  const body = encodeURIComponent(lines.join('\n').slice(0, MAX_BODY))
  const link = document.createElement('a')
  link.href = `mailto:${CONTACT.email}?subject=${subject}&body=${body}`
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function Field({ id, label, required, error, wide, children }) {
  return (
    <div className={`cf-field${wide ? ' is-wide' : ''}`}>
      <label className="cf-label" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {error && (
        <p className="cf-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export default function ContactForm() {
  const uid = useId()
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle') // idle | sending | sent | opened | error
  const [trap, setTrap] = useState('') // spam trap: people never see or fill this

  const id = (name) => `${uid}-${name}`
  const bind = (name) => ({
    id: id(name),
    value: values[name],
    'aria-invalid': errors[name] ? 'true' : undefined,
    'aria-describedby': errors[name] ? `${id(name)}-error` : undefined,
    onChange: (e) => {
      setValues((cur) => ({ ...cur, [name]: e.target.value }))
      if (errors[name]) setErrors((cur) => ({ ...cur, [name]: undefined }))
    },
  })

  const submit = async (e) => {
    e.preventDefault()
    const found = validate(values)
    setErrors(found)
    const first = Object.keys(found)[0]
    if (first) {
      document.getElementById(id(first))?.focus()
      return
    }
    if (trap) {
      setStatus('sent') // a bot filled the hidden field; pretend it worked and send nothing
      return
    }
    if (!ENDPOINT) {
      openEmailApp(values)
      setStatus('opened')
      return
    }
    setStatus('sending')
    try {
      const subject = `Project enquiry from ${values.name.trim()}`
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...values, subject, _subject: subject, ...(FORM_ACCESS_KEY && { access_key: FORM_ACCESS_KEY }) }),
      })
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      setStatus('sent')
      setValues(EMPTY)
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent' || status === 'opened') {
    return (
      <div className="contact-form cf-done reveal-card" role="status">
        <span className="cf-done-icon">
          <FiCheck aria-hidden="true" />
        </span>
        <h3>{status === 'sent' ? 'Thanks, your message is on its way.' : 'Your email is ready to send.'}</h3>
        <p>
          {status === 'sent'
            ? "I've got your details and will reply by email soon."
            : `Your email app should have opened with everything filled in. Just press send. If nothing opened, write to me at ${CONTACT.email}.`}
        </p>
        <div className="cf-foot">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus('idle')}>
            {status === 'sent' ? 'Send another message' : 'Back to the form'}
          </button>
          <p>
            Prefer to talk?{' '}
            <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
              Book a call
            </a>
          </p>
        </div>
      </div>
    )
  }

  return (
    <form className="contact-form reveal-card" onSubmit={submit} noValidate>
      <div className="cf-head">
        <h3>Tell me about your project</h3>
        <span>* Required</span>
      </div>

      <div className="cf-grid">
        <Field id={id('name')} label="Your name" required error={errors.name}>
          <input className="cf-input" type="text" autoComplete="name" placeholder="John Doe" {...bind('name')} />
        </Field>
        <Field id={id('email')} label="Email" required error={errors.email}>
          <input className="cf-input" type="email" autoComplete="email" placeholder="you@company.com" {...bind('email')} />
        </Field>
        <Field id={id('phone')} label="Phone" error={errors.phone}>
          <input className="cf-input" type="tel" autoComplete="tel" placeholder="+1 555 000 0000" {...bind('phone')} />
        </Field>
        <Field id={id('interest')} label="Interested in" required error={errors.interest}>
          <span className="cf-select">
            <select className="cf-input" {...bind('interest')}>
              <option value="">Select a service</option>
              {INTERESTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <FiChevronDown aria-hidden="true" />
          </span>
        </Field>
        <Field id={id('message')} label="Your message" required wide error={errors.message}>
          <textarea className="cf-input" rows={6} placeholder="Tell me about your project, goals and timeline…" {...bind('message')} />
        </Field>
        <input
          className="cf-trap"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={trap}
          onChange={(e) => setTrap(e.target.value)}
        />
      </div>

      {status === 'error' && (
        <p className="cf-error cf-banner" role="alert">
          Something went wrong sending your message. Please try again, or email me at{' '}
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>.
        </p>
      )}

      <div className="cf-foot">
        <button type="submit" className="btn btn-primary" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Send message'} <FiArrowUpRight aria-hidden="true" />
        </button>
        <p>
          Prefer to talk?{' '}
          <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
            Book a call
          </a>
        </p>
      </div>
    </form>
  )
}
