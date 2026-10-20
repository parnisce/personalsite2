import { useState } from 'react'
import { TbInbox, TbMail, TbMailOpened, TbTrash } from 'react-icons/tb'
import { useAdmin } from './ctx'
import { EmptyState } from './ui'

const stamp = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function EnquiriesPage() {
  const { enquiries, toast } = useAdmin()
  const { items, error, loaded, setRead, remove, unread } = enquiries
  const [open, setOpen] = useState(null)

  const toggle = (e) => {
    const next = open === e.id ? null : e.id
    setOpen(next)
    if (next && !e.read) setRead(e.id, true)
  }

  return (
    <div className="adm-page">
      <header className="adm-pagehead">
        <div>
          <h1>Enquiries</h1>
          <p className="adm-sub">
            {items.length} message{items.length === 1 ? '' : 's'} from the contact form · {unread} unread
          </p>
        </div>
      </header>

      {error && (
        <p className="adm-banner" role="alert">
          Could not load enquiries: {error}. Check that supabase/schema.sql has been run.
        </p>
      )}

      {loaded && !error && items.length === 0 && (
        <EmptyState icon={TbInbox} title="No enquiries yet">
          Messages sent from the contact form on your site show up here.
        </EmptyState>
      )}

      <ul className="adm-enq">
        {items.map((e) => (
          <li key={e.id} className={`${e.read ? '' : 'is-unread'}${open === e.id ? ' is-open' : ''}`}>
            <button type="button" className="adm-enq-head" aria-expanded={open === e.id} onClick={() => toggle(e)}>
              <i aria-hidden="true" />
              <strong>{e.name}</strong>
              <span className="adm-enq-interest">{e.interest}</span>
              <span className="adm-enq-snippet">{e.message}</span>
              <time dateTime={e.created_at}>{stamp(e.created_at)}</time>
            </button>
            {open === e.id && (
              <div className="adm-enq-body">
                <p className="adm-enq-meta">
                  <a href={`mailto:${e.email}`}>{e.email}</a>
                  {e.phone && <span> · {e.phone}</span>}
                </p>
                <p className="adm-enq-msg">{e.message}</p>
                <div className="adm-actions">
                  <a className="adm-btn is-primary" href={`mailto:${e.email}?subject=${encodeURIComponent(`Re: your enquiry about ${e.interest || 'a project'}`)}`}>
                    <TbMail aria-hidden="true" /> Reply
                  </a>
                  <button type="button" className="adm-btn is-ghost" onClick={() => setRead(e.id, !e.read)}>
                    <TbMailOpened aria-hidden="true" /> Mark as {e.read ? 'unread' : 'read'}
                  </button>
                  <button
                    type="button"
                    className="adm-btn is-danger"
                    onClick={() => {
                      if (!window.confirm(`Delete the message from ${e.name}?`)) return
                      remove(e.id)
                      toast('Enquiry deleted')
                    }}
                  >
                    <TbTrash aria-hidden="true" /> Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
