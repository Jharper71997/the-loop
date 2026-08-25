import { operationalDateInTZ } from './schedule'

// Which loop is "now"?
//
// This used to be one query: pull open loops ordered by date ascending, take
// the first 12, then pick today's / the most recent past one / the next one out
// of that list. It reads fine until you notice a loop is only "open" until
// someone presses Close out loop — and nobody had since July. With 19 open
// rows, the 12-row window ran 2026-07-03 to 2026-08-07 and never reached the
// present at all: through late August both the Tonight screen and the
// leadership live strip confidently reported the Friday Aug 7 loop.
//
// So anchor on today, not on a row count. Three narrow queries, each indexed on
// event_date, and the answer cannot drift no matter how long the close-out
// backlog gets.
//
//   todayGroup  — a loop dated today (the operational day rolls over at 4am)
//   ranGroup    — the most recent loop before today that is still open, i.e.
//                 last night's, still waiting to be wrapped up
//   nextGroup   — the next loop on the calendar
//
// `select` is passed through so callers can ask for as much or as little as
// they need (Tonight wants the rider join, the leadership strip does not).
export async function resolveActiveLoop(sb, { select, business = 'brew', upcoming = 5 } = {}) {
  const today = operationalDateInTZ()
  const base = () => sb.from('groups').select(select).eq('kind', business).is('closed_out_at', null)

  const [todayRes, pastRes, futureRes] = await Promise.all([
    base().eq('event_date', today).order('pickup_time', { ascending: true }).limit(1),
    base().lt('event_date', today).order('event_date', { ascending: false }).limit(1),
    base().gt('event_date', today).order('event_date', { ascending: true }).limit(upcoming + 1),
  ])

  const todayGroup = (todayRes.data || [])[0] || null
  const ranGroup = (pastRes.data || [])[0] || null
  const future = futureRes.data || []
  const nextGroup = future[0] || null

  const activeGroup = todayGroup || ranGroup || nextGroup || null

  // Everything else still open that isn't the one on top. Last night's loop
  // stays in the list when today has its own, so it can still be closed out.
  const upcomingGroups = [...(todayGroup && ranGroup ? [ranGroup] : []), ...future]
    .filter(g => g && g.id !== activeGroup?.id)
    .slice(0, upcoming)

  return { today, todayGroup, ranGroup, nextGroup, activeGroup, upcomingGroups }
}
