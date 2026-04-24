// Fallback hero art for event/bar cards when no cover image exists yet.
// Intentional pattern + monogram so empty slots read as designed, not missing.
export default function PlaceholderArt({ label, aspect = '16/9', variant = 'card' }) {
  const isHero = variant === 'hero'
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        aspectRatio: variant === 'card' ? aspect : undefined,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background:
          'radial-gradient(120% 80% at 20% 10%, rgba(240,194,74,0.22), transparent 55%),' +
          'radial-gradient(100% 80% at 90% 90%, rgba(212,163,51,0.18), transparent 55%),' +
          'linear-gradient(135deg, #15151a, #0a0a0b)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(rgba(212,163,51,0.12) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
          maskImage: 'radial-gradient(120% 80% at 50% 50%, #000 40%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(120% 80% at 50% 50%, #000 40%, transparent 80%)',
          opacity: 0.5,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 6,
          color: '#d4a333',
        }}
      >
        <Monogram size={isHero ? 56 : 36} />
        {label && (
          <span
            style={{
              fontSize: isHero ? 11 : 9,
              letterSpacing: '0.35em',
              textTransform: 'uppercase',
              fontWeight: 700,
              color: 'rgba(212,163,51,0.85)',
              textShadow: '0 0 10px rgba(212,163,51,0.3)',
            }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  )
}

function Monogram({ size = 36 }) {
  const stroke = size >= 48 ? 2.5 : 1.8
  const inner = size * 0.32
  return (
    <span
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        border: `${stroke}px solid #d4a333`,
        boxShadow: '0 0 18px rgba(212,163,51,0.35)',
      }}
    >
      <span
        style={{
          width: inner,
          height: inner,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #f0c24a, #d4a333)',
          boxShadow: '0 0 12px rgba(240,194,74,0.55)',
        }}
      />
    </span>
  )
}
