const DEFAULT_STOP_COUNT = 5
const DEFAULT_INTERVAL_MIN = 90

export function buildDefaultSchedule(pickupTime, firstStopName = 'Stop 1') {
  const start = parsePickup(pickupTime)
  if (!start) return null

  const stops = []
  for (let i = 0; i < DEFAULT_STOP_COUNT; i++) {
    const mins = start + i * DEFAULT_INTERVAL_MIN
    stops.push({
      name: i === 0 ? firstStopName : `Stop ${i + 1}`,
      start_time: formatMinutes(mins),
    })
  }
  return stops
}

export function currentStopIndex(schedule, nowHHMM, eventDate, todayISO) {
  if (!Array.isArray(schedule) || schedule.length === 0) return null

  if (eventDate && todayISO) {
    if (eventDate > todayISO) return -1
    if (eventDate < todayISO) return schedule.length
  }

  const now = parseHHMM(nowHHMM)
  if (now == null) return null

  let idx = -1
  for (let i = 0; i < schedule.length; i++) {
    const t = parseHHMM(schedule[i].start_time)
    if (t == null) continue
    const adjusted = t < 360 ? t + 1440 : t
    const nowAdjusted = now < 360 ? now + 1440 : now
    if (nowAdjusted >= adjusted) idx = i
  }
  return idx
}

export function nowInTZ(timeZone = 'America/Indiana/Indianapolis') {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date())
    const h = parts.find(p => p.type === 'hour')?.value
    const m = parts.find(p => p.type === 'minute')?.value
    if (!h || !m) return null
    return `${h === '24' ? '00' : h}:${m}`
  } catch {
    return null
  }
}

export function todayInTZ(timeZone = 'America/Indiana/Indianapolis') {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())
    const y = parts.find(p => p.type === 'year')?.value
    const m = parts.find(p => p.type === 'month')?.value
    const d = parts.find(p => p.type === 'day')?.value
    return `${y}-${m}-${d}`
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function parsePickup(raw) {
  if (!raw) return null
  const s = String(raw).trim()
  const m = s.match(/^(\d{1,2}):?(\d{2})?\s*([ap]\.?m\.?)?$/i)
  if (!m) return parseHHMM(s)
  let h = Number(m[1])
  const min = Number(m[2] || '0')
  const ampm = (m[3] || '').toLowerCase().replace(/\./g, '')
  if (ampm === 'pm' && h < 12) h += 12
  if (ampm === 'am' && h === 12) h = 0
  return h * 60 + min
}

function parseHHMM(raw) {
  if (!raw) return null
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null
  return h * 60 + min
}

function formatMinutes(total) {
  const normalized = ((total % 1440) + 1440) % 1440
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function parseTicketTypeName(raw) {
  if (!raw) return null
  const name = String(raw).trim()
  const m = name.match(/^(.+?)\s*[-–—]\s*(?:pickup\s*time\s*)?(\d{1,2}):?(\d{2})?\s*([ap])\.?\s*m\.?/i)
  if (!m) return null
  const stop = m[1].replace(/\s+$/, '').trim()
  let h = Number(m[2])
  const mins = Number(m[3] || '0')
  const ampm = m[4].toLowerCase()
  if (ampm === 'p' && h < 12) h += 12
  if (ampm === 'a' && h === 12) h = 0
  if (!Number.isFinite(h) || !Number.isFinite(mins)) return null
  const t = `${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
  return { name: stop, start_time: t }
}

export function scheduleFromTicketTypes(ticketTypes) {
  if (!Array.isArray(ticketTypes)) return null
  const parsed = ticketTypes
    .map(t => ({ parsed: parseTicketTypeName(t?.name), sort: Number(t?.sort_order || 0) }))
    .filter(x => x.parsed)
    .sort((a, b) => a.sort - b.sort)
    .map(x => x.parsed)
  return parsed.length ? parsed : null
}

export function formatStopTime(hhmm) {
  const mins = parseHHMM(hhmm)
  if (mins == null) return hhmm || ''
  const h24 = Math.floor(mins / 60)
  const m = mins % 60
  const suffix = h24 >= 12 ? 'PM' : 'AM'
  const h12 = ((h24 + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}
