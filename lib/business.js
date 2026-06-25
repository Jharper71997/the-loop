// Client-safe helpers for the active staff business (Brew vs Surf City).
//
// The /admin HUD is shared across businesses; a `business` cookie scopes every
// query to the toggled business. This file is import-safe in client components
// (no next/headers) — server code reads the same cookie via lib/businessServer.
//
// Cookie is intentionally NOT httpOnly so the two top-level 'use client' admin
// pages (contacts, finance) and the NavBar toggle can read/write it directly.

export const BUSINESS_COOKIE = 'business'

const VALID = new Set(['brew', 'surf'])

// Read the active business from document.cookie. Defaults to 'brew' (matches
// SSR + every server default) and is SSR-safe (guards `document`).
export function readBusinessCookie() {
  if (typeof document === 'undefined') return 'brew'
  const m = document.cookie.match(/(?:^|;\s*)business=([^;]+)/)
  const v = m ? decodeURIComponent(m[1]) : 'brew'
  return VALID.has(v) ? v : 'brew'
}

// Persist the active business for a year, site-wide. Lax so it rides along on
// top-level navigations (the toggle then router.refresh()es server pages).
export function setBusinessCookie(value) {
  if (typeof document === 'undefined') return
  const v = VALID.has(value) ? value : 'brew'
  document.cookie = `business=${v}; path=/; max-age=31536000; samesite=lax`
}
