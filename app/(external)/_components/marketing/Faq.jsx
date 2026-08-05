// The FAQ treatment, shared by / and /about.
//
// Both pages used to render their own: the landing page had thin-rule
// disclosure rows in two columns, /about had a grid of fat bordered cards. Same
// questions, two different objects — which is exactly the kind of thing that
// makes a site feel like it was assembled by different people.
//
// Content always comes from lib/riderInfo.js; this is only the shape.

export default function Faq({ items = [], columns = true }) {
  return (
    <>
      <div className={columns ? 'bl-faq bl-faq-2' : 'bl-faq'}>
        {items.map((it, i) => (
          <details key={i} className="bl-faq-item">
            <summary>
              <span>{it.q}</span>
              <span aria-hidden className="bl-faq-plus">+</span>
            </summary>
            <p>{it.a}</p>
          </details>
        ))}
      </div>
      <style>{`
        .bl-faq { margin-top: 22px; column-gap: 44px; }
        @media (min-width: 860px) { .bl-faq-2 { column-count: 2; } }
        .bl-faq-item {
          break-inside: avoid;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          padding: 15px 0;
        }
        .bl-faq-item summary {
          cursor: pointer; list-style: none; display: flex; gap: 14px;
          align-items: center; justify-content: space-between;
          color: #f5f5f7; font-weight: 700; font-size: 15.5px; line-height: 1.35;
        }
        .bl-faq-item summary::-webkit-details-marker { display: none; }
        .bl-faq-item summary:hover { color: #f0c24a; }
        .bl-faq-plus {
          color: #d4a333; font-size: 20px; line-height: 1; flex: 0 0 auto;
          transition: transform .2s ease;
        }
        .bl-faq-item[open] .bl-faq-plus { transform: rotate(45deg); }
        .bl-faq-item p {
          color: #b8b8bf; font-size: 14.5px; line-height: 1.62;
          margin: 10px 0 0; padding-right: 30px;
        }
      `}</style>
    </>
  )
}
