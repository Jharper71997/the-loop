import { sendSms } from './sms'
import { isOptedOut } from './smsStore'
import { joinUrl } from './doorPickup'
import { SMS_OPT_OUT_LINE } from './legal'

// Door pickup texts, all sent through SimpleTexting (lib/sms.js sendSms), so
// every one lands in the /admin/messages thread. Nobody has to forward a link
// from their own phone: the organizer's friends get their pay link the moment
// the organizer pays, and crew send "on my way" from the Loops card.

const slotHour = slot => String(slot || '').replace(/\s*·\s*Zone\s*\d/i, '')

export function payLinkText({ friend, organizer, slot, link }) {
  const from = (organizer || '').split(' ')[0] || 'Your friend'
  return `Brew Loop: Hi ${friend.first_name}, ${from} added you to their Oktoberfest pickup (${slotHour(slot)}). Your seat is held. Pay your $10 here: ${link}\n${SMS_OPT_OUT_LINE}`
}

export function onMyWayText(organizer) {
  const first = (organizer || '').split(' ')[0] || 'there'
  return `Brew Loop: Hi ${first}, this is your driver. I'm on my way to pick up your group for Oktoberfest. Please be ready out front.`
}

// After an organizer's order is paid: text each "pays their own seat" friend
// their personal link. Stamps roster[i].texted_at so the webhook retry, the
// resend endpoint and a claim re-finalizing the order never text twice.
export async function textRosterFriends(supabase, orderId) {
  const { data: order } = await supabase
    .from('orders')
    .select('id, event_id, status, buyer_name, metadata')
    .eq('id', orderId)
    .maybeSingle()
  const door = order?.metadata?.door_pickup
  if (order?.status !== 'paid' || !door || door.party_of || !Array.isArray(door.roster) || !door.join_code) return []

  const results = []
  const roster = door.roster.map(f => ({ ...f }))
  for (const f of roster) {
    if (f.texted_at || !f.phone) continue
    if (await isOptedOut(supabase, f.phone)) { results.push({ token: f.token, skipped: 'opted_out' }); continue }
    const link = `${joinUrl(order.event_id, door.join_code)}&seat=${f.token}`
    try {
      const r = await sendSms(f.phone, payLinkText({ friend: f, organizer: order.buyer_name, slot: door.slot, link }))
      if (r?.skipped) { results.push({ token: f.token, skipped: r.reason || r.skipped }); continue }
      f.texted_at = new Date().toISOString()
      results.push({ token: f.token, sent: true })
    } catch (err) {
      console.error('[doorPickupTexts] friend link failed', err?.message || err)
      results.push({ token: f.token, error: err?.message || String(err) })
    }
  }

  if (results.some(r => r.sent)) {
    // Re-read so a write that landed meanwhile is not clobbered.
    const { data: fresh } = await supabase.from('orders').select('metadata').eq('id', order.id).maybeSingle()
    const meta = fresh?.metadata || order.metadata
    const stamped = new Map(roster.filter(f => f.texted_at).map(f => [f.token, f.texted_at]))
    const nextRoster = (meta.door_pickup?.roster || []).map(f => stamped.has(f.token) ? { ...f, texted_at: f.texted_at || stamped.get(f.token) } : f)
    await supabase.from('orders')
      .update({ metadata: { ...meta, door_pickup: { ...meta.door_pickup, roster: nextRoster } } })
      .eq('id', order.id)
  }
  return results
}
