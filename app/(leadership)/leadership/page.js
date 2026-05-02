import { getScoreboard, formatCents, formatNumber, formatPercent } from '@/lib/leadershipScoreboard'
import MetricCard from '../_components/MetricCard'

export const dynamic = 'force-dynamic'

const FONT_BODY = '-apple-system, "Segoe UI", Roboto, sans-serif'

export default async function LeadershipScoreboard() {
  const data = await getScoreboard()

  const sections = [
    {
      title: 'Money Now',
      subtitle: 'What we made',
      cards: [
        { ...data.weeklyRevenue,
          value: formatCents(data.weeklyRevenue.valueCents),
          target: formatCents(data.weeklyRevenue.targetCents) + ' / wk',
        },
        { ...data.bankBalance,
          value: formatCents(data.bankBalance.valueCents),
          target: '≥ ' + formatCents(data.bankBalance.targetCents),
        },
        { ...data.netProfitMTD,
          value: formatCents(data.netProfitMTD.valueCents),
          target: formatCents(data.netProfitMTD.targetCents) + ' / mo',
        },
        { ...data.daysRunway,
          value: formatNumber(data.daysRunway.value) + (data.daysRunway.value != null ? ' days' : ''),
          target: '≥ ' + data.daysRunway.target + ' days',
        },
      ],
    },
    {
      title: 'Money Soon',
      subtitle: 'What predicts next week',
      cards: [
        { ...data.presold,
          value: formatNumber(data.presold.value),
          target: formatNumber(data.presold.target),
        },
        { ...data.sponsorPipeline,
          value: data.sponsorPipeline.valueCents != null ? formatCents(data.sponsorPipeline.valueCents) : '—',
          target: formatCents(data.sponsorPipeline.targetCents) + ' in proposal',
        },
        { ...data.barPipeline,
          value: formatNumber(data.barPipeline.value),
          target: formatNumber(data.barPipeline.target) + ' prospects',
        },
        { ...data.conversion,
          value: data.conversion.value != null ? formatPercent(data.conversion.value) : '—',
          target: '≥ ' + formatPercent(data.conversion.target),
        },
      ],
    },
    {
      title: 'Capacity',
      subtitle: 'Can we deliver this weekend',
      cards: [
        { ...data.activeSponsors,
          value: formatNumber(data.activeSponsors.value),
          target: formatNumber(data.activeSponsors.target),
        },
        { ...data.activeBars,
          value: formatNumber(data.activeBars.value),
          target: formatNumber(data.activeBars.target) + '+',
        },
        { ...data.weekendRiders,
          value: formatNumber(data.weekendRiders.value),
          target: '≥ ' + formatNumber(data.weekendRiders.target),
        },
        { ...data.drivers,
          value: formatNumber(data.drivers.value),
          target: '≥ ' + formatNumber(data.drivers.target),
          drillTo: '/leadership/drivers',
        },
      ],
    },
  ]

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0a0a0b',
      color: '#e8e8ea',
      padding: '24px 16px 48px',
      fontFamily: FONT_BODY,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{
            color: '#e8e8ea',
            fontFamily: FONT_BODY,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            margin: 0,
          }}>
            Scoreboard
          </h1>
          <p style={{
            color: '#9c9ca3',
            fontSize: 13,
            margin: '4px 0 0 0',
          }}>
            Live · {new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </p>
        </header>

        {sections.map(section => (
          <section key={section.title} style={{ marginBottom: 28 }}>
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
              marginBottom: 12,
              borderBottom: '1px solid #2a2a31',
              paddingBottom: 6,
            }}>
              <h2 style={{
                color: '#e8e8ea',
                fontFamily: FONT_BODY,
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                margin: 0,
              }}>
                {section.title}
              </h2>
              <span style={{
                color: '#9c9ca3',
                fontSize: 12,
              }}>
                {section.subtitle}
              </span>
            </div>

            <div className="leadership-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
            }}>
              {section.cards.map((card, i) => (
                <MetricCard key={i} {...card} />
              ))}
            </div>
          </section>
        ))}

        <style>{`
          @media (max-width: 900px) {
            .leadership-grid { grid-template-columns: repeat(2, 1fr) !important; }
          }
          @media (max-width: 520px) {
            .leadership-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </main>
  )
}
