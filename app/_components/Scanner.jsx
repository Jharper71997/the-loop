'use client'

import { useEffect, useRef, useState } from 'react'

// Shared QR scanner. Two decode paths:
//   1. BarcodeDetector — native, fast, ~10ms per frame. Available in Chromium
//      (Android Chrome, desktop Chrome). NOT available in Safari/iOS yet.
//   2. jsQR fallback — pure JS, works everywhere with getUserMedia.
//
// iOS Safari requires the camera to be initiated from a user gesture, so we
// expose an explicit "Start scanning" button rather than auto-starting.
//
// Props:
//   onScan(code)      — fires once per decoded code; debounced 1.5s
//   prompt            — copy under the viewfinder (e.g. "Aim at the rider's
//                       boarding pass")
//   busy              — while true, decoding pauses (e.g. while the API call
//                       to /api/checkin is in-flight)
export default function Scanner({ onScan, prompt = 'Aim at a ticket QR', busy = false }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const detectorRef = useRef(null)
  const rafRef = useRef(0)
  const lastCodeRef = useRef({ code: null, at: 0 })
  const busyRef = useRef(busy)

  const [active, setActive] = useState(false)
  const [error, setError] = useState(null)
  const [decoder, setDecoder] = useState('idle')

  useEffect(() => { busyRef.current = busy }, [busy])

  useEffect(() => {
    return () => stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function start() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      setActive(true)

      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          // eslint-disable-next-line no-undef
          detectorRef.current = new BarcodeDetector({ formats: ['qr_code'] })
          setDecoder('native')
        } catch {
          detectorRef.current = null
          setDecoder('jsqr')
        }
      } else {
        setDecoder('jsqr')
      }

      loop()
    } catch (err) {
      setError(err?.message || 'Camera access blocked. Allow camera in your browser settings.')
      setActive(false)
    }
  }

  function stop() {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    setActive(false)

    const stream = streamRef.current
    if (stream) {
      for (const track of stream.getTracks()) {
        try { track.stop() } catch {}
      }
      streamRef.current = null
    }
    const video = videoRef.current
    if (video) {
      try { video.pause() } catch {}
      video.srcObject = null
    }
    detectorRef.current = null
  }

  function emit(decoded) {
    const now = Date.now()
    if (decoded === lastCodeRef.current.code && now - lastCodeRef.current.at < 1500) {
      return
    }
    lastCodeRef.current = { code: decoded, at: now }
    onScan?.(decoded)
  }

  async function loop() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) {
      rafRef.current = requestAnimationFrame(loop)
      return
    }

    if (busyRef.current || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop)
      return
    }

    try {
      if (detectorRef.current) {
        // BarcodeDetector reads directly from the video element.
        const codes = await detectorRef.current.detect(video)
        if (codes && codes.length) {
          const raw = codes[0].rawValue
          if (raw) emit(extractCode(raw))
        }
      } else {
        // jsQR path — copy the current frame to canvas and decode pixels.
        const w = video.videoWidth
        const h = video.videoHeight
        if (w && h) {
          if (canvas.width !== w) canvas.width = w
          if (canvas.height !== h) canvas.height = h
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          ctx.drawImage(video, 0, 0, w, h)
          const img = ctx.getImageData(0, 0, w, h)
          const { default: jsQR } = await import('jsqr')
          const result = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
          if (result?.data) emit(extractCode(result.data))
        }
      }
    } catch {
      // ignore per-frame errors — the next frame will retry
    }

    rafRef.current = requestAnimationFrame(loop)
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div
        style={{
          position: 'relative',
          aspectRatio: '1 / 1',
          width: '100%',
          maxWidth: 480,
          margin: '0 auto',
          borderRadius: 18,
          overflow: 'hidden',
          background: '#000',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: active ? 'block' : 'none',
          }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {!active && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              color: '#f5f5f7',
              padding: 24,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 13, color: '#b8b8bf' }}>{prompt}</div>
            <button
              type="button"
              onClick={start}
              style={{
                padding: '14px 22px',
                borderRadius: 12,
                background: 'linear-gradient(180deg, #f0c24a, #d4a333)',
                color: '#0a0a0b',
                border: 0,
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
                boxShadow: '0 10px 30px rgba(212,163,51,0.25)',
              }}
            >
              Start scanning
            </button>
            {error && (
              <div style={{ color: '#e07a7a', fontSize: 12, maxWidth: 280 }}>{error}</div>
            )}
          </div>
        )}

        {active && (
          <>
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '60%',
                aspectRatio: '1 / 1',
                border: '2px solid rgba(212,163,51,0.85)',
                borderRadius: 18,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 10,
                left: 10,
                fontSize: 10,
                color: 'rgba(255,255,255,0.5)',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {decoder === 'native' ? 'native qr' : 'jsqr'}
            </div>
            <button
              type="button"
              onClick={stop}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                padding: '6px 12px',
                borderRadius: 999,
                background: 'rgba(0,0,0,0.55)',
                color: '#f5f5f7',
                border: '1px solid rgba(255,255,255,0.18)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Stop
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// QR codes generated for tickets encode the URL `${appUrl}/r/<code>`. Pull the
// last path segment so the API call uses just the code. Falls back to the raw
// value if it's already a bare code (e.g. someone scans a printed legacy code).
function extractCode(raw) {
  if (!raw) return ''
  const trimmed = String(raw).trim()
  try {
    const u = new URL(trimmed)
    const parts = u.pathname.split('/').filter(Boolean)
    return parts[parts.length - 1] || trimmed
  } catch {
    return trimmed
  }
}
