import { th, td, tableWrap, MONO } from './tableStyles'

// Server component. Renders a real <table> on desktop and, below 640px,
// collapses each row into a stacked card via CSS only (no client JS) so it
// drops into force-dynamic server pages without forcing client rendering.
//
// columns: [{ key, header, align?, mono?, primary?, hideOnMobile?, render? }]
//   - render(row) returns the cell node (badges, links, etc.)
//   - primary: shown as the card title on mobile (no label, full width)
//   - hideOnMobile: dropped from the mobile card (noise columns)
// rows:   array of row objects
// rowKey: (row, i) => stable key
// empty:  node shown when rows is empty
export default function DataTable({ columns, rows, rowKey, empty }) {
  if (!rows || rows.length === 0) {
    return empty != null ? empty : (
      <div style={{ color: '#9c9ca3', fontSize: 13, padding: '16px 2px' }}>Nothing yet.</div>
    )
  }

  return (
    <div className="dt-wrap" style={{ ...tableWrap, marginBottom: 24 }}>
      <table className="dt" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#0d0d10' }}>
            {columns.map(c => (
              <th key={c.key} style={{ ...th, textAlign: c.align || 'left' }}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey ? rowKey(row, i) : i}>
              {columns.map(c => {
                const cls = [c.primary ? 'dt-primary' : '', c.hideOnMobile ? 'dt-hide-mobile' : '']
                  .join(' ').trim()
                return (
                  <td
                    key={c.key}
                    data-label={c.header}
                    className={cls || undefined}
                    style={{
                      ...td,
                      textAlign: c.align || 'left',
                      fontFamily: c.mono ? MONO : undefined,
                    }}
                  >
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <style>{`
        @media (max-width: 640px) {
          .dt-wrap { background: none !important; border: none !important; border-radius: 0 !important; overflow: visible !important; margin-bottom: 16px; }
          .dt thead { display: none; }
          .dt, .dt tbody, .dt tr, .dt td { display: block; width: 100%; }
          .dt tr {
            border: 1px solid #2a2a31;
            border-radius: 8px;
            margin-bottom: 10px;
            padding: 4px 0;
            background: linear-gradient(180deg, #121216, #0d0d10);
          }
          .dt td {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            gap: 14px;
            padding: 8px 14px !important;
            text-align: right !important;
            border: none !important;
          }
          .dt td::before {
            content: attr(data-label);
            color: #9c9ca3;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            text-align: left;
            flex-shrink: 0;
            white-space: nowrap;
          }
          .dt td.dt-primary {
            justify-content: flex-start;
            text-align: left !important;
            font-size: 15px;
            padding-top: 12px !important;
            padding-bottom: 4px !important;
          }
          .dt td.dt-primary::before { display: none; }
          .dt td.dt-hide-mobile { display: none; }
        }
      `}</style>
    </div>
  )
}
