// The FAQ treatment, shared by / and /about.
//
// Both pages used to render their own: the landing page had thin-rule
// disclosure rows in two columns, /about had a grid of fat bordered cards. Same
// questions, two different objects — which is exactly the kind of thing that
// makes a site feel like it was assembled by different people.
//
// Content always comes from lib/riderInfo.js; this is only the shape.
//
// `tone` follows the band it is dropped into. The landing page's questions now
// sit on a light band (see lib/marketingTheme.js on why the merch section went
// to paper), and every colour in here was a hardcoded white-on-dark value — so
// the FAQ has to be told which end of the value scale it is on or it renders
// invisible. Ink on paper, not a theme: pass tone="paper" from a light band.

export default function Faq({ items = [], columns = true, tone = 'dark' }) {
  const paper = tone === 'paper'
  return (
    <>
      <div className={[columns ? 'bl-faq bl-faq-2' : 'bl-faq', paper ? 'bl-faq-paper' : ''].filter(Boolean).join(' ')}>
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

        /* Light band. The hover colour has to change too: GOLD_HI is a
           highlight against black and nearly white against cream, so on paper
           the hover uses GOLD_INK, the text-weight gold. */
        .bl-faq-paper .bl-faq-item { border-bottom-color: rgba(23,23,26,0.12); }
        .bl-faq-paper .bl-faq-item summary { color: #16161a; }
        .bl-faq-paper .bl-faq-item summary:hover { color: #8a6410; }
        .bl-faq-paper .bl-faq-plus { color: #8a6410; }
        .bl-faq-paper .bl-faq-item p { color: #4d4d57; }
      `}</style>
    </>
  )
}
