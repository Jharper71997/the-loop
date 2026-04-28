'use client'

import { useEffect, useState } from 'react'
import SummaryView from './views/SummaryView'
import EditView from './views/EditView'
import TicketsView from './views/TicketsView'

const ACCENT = '#d4a333'
const ACCENT_HI = '#f0c24a'
const SURFACE = '#15151a'
const SURFACE_HI = '#1a1a20'
const BORDER = '#2a2a31'
const INK = '#f5f5f7'
const INK_DIM = '#9c9ca3'

const VIEWS = [
  { id: 'summary', label: 'Event summary', section: 'Overview' },
  { id: 'edit', label: 'Edit event and tickets', section: 'Settings' },
  { id: 'tickets', label: 'Tickets and items', section: 'Settings' },
]
const VIEW_IDS = new Set(VIEWS.map(v => v.id))

export default function EventShell({
  group,
  event,
  ticketTypes,
  members,
  orders,
  orderItems,
  waiverSigs,
}) {
  const [view, setView] = useState('summary')
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Sync view from URL hash so links can deep-link to a tab.
  useEffect(() => {
    function syncFromHash() {
      const h = (window.location.hash || '').replace('#', '')
      if (VIEW_IDS.has(h)) setView(h)
    }
    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  function go(id) {
    setView(id)
    setDrawerOpen(false)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${id}`)
    }
  }

  async function copyLink() {
    if (!event?.id) return
    const url = `${window.location.origin}/book/${event.id}`
    try {
      await navigator.clipboard.writeText(url)
      alert('Booking link copied')
    } catch {}
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      {/* Mobile drawer scrim */}
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            border: 0,
            zIndex: 40,
            cursor: 'pointer',
          }}
          className="event-shell-scrim"
        />
      )}

      <Sidebar
        group={group}
        event={event}
        view={view}
        onSelect={go}
        onCopyLink={copyLink}
        drawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      />

      <main style={{ flex: 1, minWidth: 0, padding: '20px 16px 60px', maxWidth: '100%' }}>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="event-shell-burger"
          style={{
            display: 'none',
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            color: INK,
            padding: '8px 14px',
            borderRadius: 8,
            fontSize: 13,
            cursor: 'pointer',
            marginBottom: 14,
            alignItems: 'center',
            gap: 8,
          }}
        >
          ☰ {VIEWS.find(v => v.id === view)?.label || 'Menu'}
        </button>

        {view === 'summary' && (
          <SummaryView
            group={group}
            event={event}
            ticketTypes={ticketTypes}
            members={members}
            orders={orders}
            orderItems={orderItems || []}
            waiverSigs={waiverSigs}
            onJumpToEdit={() => go('edit')}
            onJumpToTickets={() => go('tickets')}
          />
        )}
        {view === 'edit' && <EditView group={group} event={event} />}
        {view === 'tickets' && (
          <TicketsView
            event={event}
            ticketTypes={ticketTypes}
            stops={Array.isArray(group.schedule) ? group.schedule : []}
          />
        )}
      </main>

      <style>{`
        @media (max-width: 859px) {
          .event-shell-burger { display: inline-flex !important; }
          .event-shell-sidebar { display: none !important; }
          .event-shell-sidebar.open { display: flex !important; position: fixed; top: 0; bottom: 0; left: 0; width: 280px; z-index: 50; }
        }
        @media (min-width: 860px) {
          .event-shell-scrim { display: none; }
        }
      `}</style>
    </div>
  )
}

function Sidebar({ group, event, view, onSelect, onCopyLink, drawerOpen, onCloseDrawer }) {
  const sections = ['Overview', 'Settings']
  const isLive = group.event_date && (() => {
    try { return new Date(`${group.event_date}T00:00:00`).toDateString() === new Date().toDateString() } catch { return false }
  })()

  return (
    <aside
      className={`event-shell-sidebar${drawerOpen ? ' open' : ''}`}
      style={{
        width: 240,
        flexShrink: 0,
        background: 'linear-gradient(180deg, #0d0d10, #0a0a0b)',
        borderRight: `1px solid ${BORDER}`,
        padding: '14px 14px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        position: 'sticky',
        top: 60,
        alignSelf: 'flex-start',
        height: 'calc(100vh - 60px)',
        overflowY: 'auto',
      }}
    >
      <button
        type="button"
        onClick={onCloseDrawer}
        aria-label="Close"
        style={{
          display: 'none',
          alignSelf: 'flex-end',
          background: 'transparent',
          color: INK_DIM,
          border: 0,
          fontSize: 22,
          cursor: 'pointer',
          padding: 4,
          marginBottom: -4,
        }}
        className="event-shell-sidebar-close"
      >
        ×
      </button>

      <div>
        <a href="/admin/groups" style={{ color: ACCENT, fontSize: 12, textDecoration: 'none', letterSpacing: '0.06em' }}>
          ← All Loops
        </a>
        <div style={{ marginTop: 10 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            color: INK,
            lineHeight: 1.25,
            wordBreak: 'break-word',
          }}>
            {group.name}
          </div>
          <div style={{ color: INK_DIM, fontSize: 11, marginTop: 4, letterSpacing: '0.04em' }}>
            {group.event_date || 'No date'}
            {group.pickup_time ? ` · ${group.pickup_time}` : ''}
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusPill status={event?.status || 'draft'} />
            {isLive && <LivePill />}
          </div>
        </div>
      </div>

      {sections.map(s => (
        <div key={s}>
          <div style={{
            fontSize: 10,
            color: INK_DIM,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontWeight: 700,
            margin: '4px 0 6px',
          }}>
            {s}
          </div>
          <div style={{ display: 'grid', gap: 2 }}>
            {VIEWS.filter(v => v.section === s).map(v => {
              const active = v.id === view
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSelect(v.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 12px',
                    borderRadius: 8,
                    background: active ? 'rgba(212,163,51,0.12)' : 'transparent',
                    border: active ? `1px solid ${ACCENT}` : '1px solid transparent',
                    color: active ? ACCENT_HI : INK,
                    fontSize: 13,
                    fontWeight: 600,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  {v.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
        <div style={{
          fontSize: 10,
          color: INK_DIM,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          fontWeight: 700,
          margin: '0 0 6px',
        }}>
          Actions
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          {event?.id && (
            <a
              href={`/book/${event.id}`}
              target="_blank"
              rel="noreferrer"
              style={actionLink}
            >
              View public page
            </a>
          )}
          <button type="button" onClick={onCopyLink} style={actionBtn}>
            Copy booking link
          </button>
        </div>
      </div>

      <style>{`
        @media (max-width: 859px) {
          .event-shell-sidebar-close { display: inline-flex !important; }
        }
      `}</style>
    </aside>
  )
}

function StatusPill({ status }) {
  const palette = {
    on_sale:   { bg: 'rgba(111,191,127,0.12)', border: 'rgba(111,191,127,0.4)', color: '#6fbf7f', label: 'On sale' },
    draft:     { bg: 'rgba(212,163,51,0.10)',  border: 'rgba(212,163,51,0.45)', color: ACCENT_HI, label: 'Draft' },
    sold_out:  { bg: 'rgba(255,140,80,0.12)',  border: 'rgba(255,140,80,0.45)', color: '#ffb074', label: 'Sold out' },
    cancelled: { bg: 'rgba(224,122,122,0.12)', border: 'rgba(224,122,122,0.4)', color: '#e07a7a', label: 'Cancelled' },
  }[status] || { bg: SURFACE, border: BORDER, color: INK_DIM, label: status }
  return (
    <span style={{
      fontSize: 10,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      fontWeight: 700,
      padding: '3px 8px',
      borderRadius: 999,
      background: palette.bg,
      border: `1px solid ${palette.border}`,
      color: palette.color,
    }}>
      {palette.label}
    </span>
  )
}

function LivePill() {
  return (
    <span style={{
      fontSize: 10,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      fontWeight: 700,
      padding: '3px 8px',
      borderRadius: 999,
      background: 'rgba(111,191,127,0.12)',
      border: '1px solid rgba(111,191,127,0.4)',
      color: '#6fbf7f',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: '#6fbf7f', boxShadow: '0 0 8px #6fbf7f',
      }} />
      Live
    </span>
  )
}

const actionLink = {
  padding: '8px 12px',
  borderRadius: 8,
  color: INK,
  fontSize: 12,
  fontWeight: 600,
  textDecoration: 'none',
  background: 'transparent',
  border: '1px solid transparent',
  cursor: 'pointer',
  display: 'block',
}

const actionBtn = {
  padding: '8px 12px',
  borderRadius: 8,
  color: INK,
  fontSize: 12,
  fontWeight: 600,
  background: 'transparent',
  border: '1px solid transparent',
  cursor: 'pointer',
  textAlign: 'left',
  display: 'block',
  width: '100%',
}
