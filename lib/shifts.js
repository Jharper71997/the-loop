// Helpers for the staff_shifts table (drivers + door security per weekend night).

import { todayInTZ } from './schedule'

export const NIGHTS = [
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
]

export const ROLES = [
  { key: 'driver',   label: 'Driver',   color: '#d4a333' },
  { key: 'security', label: 'Security', color: '#7aa2ff' },
]

// Returns an array of weekend objects covering the next `count` weekends
// (inclusive of the current one if today is Fri/Sat/Sun).
//
// Each weekend object: { label, friDate, satDate }
// Dates are YYYY-MM-DD strings (no TZ math beyond America/Indiana TZ).
export function upcomingWeekends(count = 4) {
  const today = todayInTZ()
  const [y, m, d] = today.split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1, d))
  const dow = base.getUTCDay() // 0=Sun..6=Sat
  // Walk back to this week's Friday (dow 5).
  // If today is Sun, last Fri was 2 days ago; if Mon, 4 days ago, etc.
  let offset
  if (dow === 5) offset = 0
  else if (dow === 6) offset = -1
  else if (dow === 0) offset = -2
  else offset = 5 - dow // Mon→4 ahead, Tue→3, Wed→2, Thu→1
  const weekends = []
  for (let i = 0; i < count; i++) {
    const friday = new Date(base)
    friday.setUTCDate(base.getUTCDate() + offset + i * 7)
    const saturday = new Date(friday)
    saturday.setUTCDate(friday.getUTCDate() + 1)
    weekends.push({
      friDate: ymd(friday),
      satDate: ymd(saturday),
      label: weekendLabel(friday, saturday),
    })
  }
  return weekends
}

function ymd(d) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function weekendLabel(fri, sat) {
  const monthShort = (d) => d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  const day = (d) => d.getUTCDate()
  if (fri.getUTCMonth() === sat.getUTCMonth()) {
    return `${monthShort(fri)} ${day(fri)} – ${day(sat)}`
  }
  return `${monthShort(fri)} ${day(fri)} – ${monthShort(sat)} ${day(sat)}`
}

// Group a flat shift list into { [date]: { driver: [], security: [] } }.
export function groupShiftsByDate(shifts) {
  const out = {}
  for (const s of shifts || []) {
    if (!out[s.shift_date]) out[s.shift_date] = { driver: [], security: [] }
    if (out[s.shift_date][s.role]) out[s.shift_date][s.role].push(s)
  }
  return out
}
