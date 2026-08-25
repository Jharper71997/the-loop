'use client'

import { useLiveRefresh, ago } from './useLiveRefresh'

const FONT_BODY = '-apple-system, "Segoe UI", Roboto, sans-serif'

// Honest freshness indicator: green dot + "Updated Xs ago" + manual Refresh.
// Drop it under any server page heading and pass `renderedAt` from serverNow().
export default function LiveStamp({ renderedAt, intervalMs, style }) {
  const { now, refreshing, refresh } = useLiveRefresh(renderedAt, intervalMs ? { intervalMs } : undefined)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, ...style }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: refreshing ? '#d4a333' : '#3fb27f',
          boxShadow: `0 0 8px ${refreshing ? 'rgba(212,163,51,0.6)' : 'rgba(63,178,127,0.55)'}`,
          transition: 'background 0.2s',
        }} />
        <span style={{ color: '#9c9ca3', fontSize: 13, fontFamily: FONT_BODY }}>
          {refreshing ? 'Refreshing…' : `Updated ${ago(now - renderedAt)}`}
        </span>
      </span>
      <button
        onClick={refresh}
        disabled={refreshing}
        style={{
          background: 'none',
          border: '1px solid #2a2a31',
          color: '#9c9ca3',
          fontFamily: FONT_BODY,
          fontSize: 12,
          fontWeight: 500,
          padding: '4px 10px',
          borderRadius: 6,
          cursor: refreshing ? 'default' : 'pointer',
          opacity: refreshing ? 0.5 : 1,
        }}
      >
        Refresh
      </button>
    </div>
  )
}
