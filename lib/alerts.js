// recordAlert — append a row to the notifications table so failures bubble
// up to the admin notifications page + the 15-min batched alert email cron.
//
// Never throws. If the alert insert itself fails, we log to console and move
// on; we don't want the alert path to make the original failure worse.

export async function recordAlert(supabase, { kind, severity = 'error', subject, body, context }) {
  if (!supabase || !kind) return null
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        kind,
        severity,
        subject: subject ? String(subject).slice(0, 500) : null,
        body: body ? String(body).slice(0, 4000) : null,
        context: context || null,
      })
      .select('id')
      .single()
    if (error) {
      console.error('[recordAlert] insert failed', error.message)
      return null
    }
    return data?.id || null
  } catch (err) {
    console.error('[recordAlert] threw', err?.message || err)
    return null
  }
}
