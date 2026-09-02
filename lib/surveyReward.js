// The 50%-off code paid out for completing the /feedback survey.
//
// The campaign: previous riders get emailed asking them to fill out the survey,
// and everyone who finishes gets this confirmation carrying the code.
//
// THREE RULES, and they are not style preferences — breaking any of them turns
// this into an incentivised Google review, which costs the reviews and can cost
// the listing (same reasoning as the header on bl-review-email.js):
//
//   1. Paid for the FEEDBACK, never for a review. Nothing here reads
//      review_clicked_at, and nothing ever should.
//   2. Paid at EVERY rating, 1 star through 5. A 1-star rider earned it the
//      same way a 5-star rider did. Do not add a rating floor.
//   3. Delivered by EMAIL, so the code never shares a screen with the Google
//      button on the thank-you step.
//
// Called from /api/feedback on submit. The survey POSTs several times per rider
// (star tap, submit, review tap), so the send is guarded by a conditional
// stamp on reward_sent_at rather than a read-then-write, which would mail the
// code once per tap under any concurrency at all.

import { sendEmail } from './email'
import { surveyRewardHtml, surveyRewardText } from './emailTemplates'
import { appUrl } from './stripe'
import { isAutomationEnabled, AUTOMATION_KEYS } from './automationSettings'
import { recordAlert } from './alerts'

const SUBJECT = 'Your 50% off code'

export function rewardCode() {
  return (process.env.SURVEY_REWARD_CODE || 'SURVEY').trim().toUpperCase()
}

// "good through October 31" when an expiry is configured, and an honest hedge
// when it is not. Never claim a deadline the discount code does not actually
// carry — the code is created with a matching expiry by
// bl-create-survey-code.js, and the two have to say the same thing.
export function rewardExpiresLabel() {
  const raw = (process.env.SURVEY_REWARD_EXPIRES || '').trim()
  if (!raw) return 'while the offer lasts'
  const d = new Date(`${raw}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return 'while the offer lasts'
  return `good through ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}`
}

// Claim, send, and on a send failure release the claim so the rider can still
// be paid on a retry. A rider who was promised a code and silently got nothing
// is the one outcome this whole flow exists to avoid.
export async function grantSurveyReward(sb, { feedbackId, email, firstName, origin }) {
  if (!feedbackId || !email) return { skipped: 'no_email' }

  if (!(await isAutomationEnabled(AUTOMATION_KEYS.SURVEY_REWARD_EMAIL))) {
    return { skipped: 'disabled' }
  }

  const code = rewardCode()

  // The claim. `reward_sent_at is null` in the WHERE is the whole lock: two
  // concurrent submits race here and exactly one comes back with a row.
  const { data: claimed, error: claimErr } = await sb
    .from('ride_feedback')
    .update({ reward_sent_at: new Date().toISOString(), reward_code: code })
    .eq('id', feedbackId)
    .is('reward_sent_at', null)
    .select('id')
    .maybeSingle()

  if (claimErr) {
    console.error('[surveyReward] claim failed', claimErr.message)
    return { skipped: 'claim_failed' }
  }
  if (!claimed) return { skipped: 'already_sent' }

  const base = appUrl(origin)
  try {
    const res = await sendEmail({
      to: email,
      subject: SUBJECT,
      html: surveyRewardHtml({ firstName, code, bookUrl: `${base}/events`, expiresLabel: rewardExpiresLabel() }),
      text: surveyRewardText({ firstName, code, bookUrl: `${base}/events`, expiresLabel: rewardExpiresLabel() }),
      replyTo: 'jacob@jvillebrewloop.com',
    })
    // sendEmail resolves (rather than throwing) when RESEND_API_KEY is unset.
    // That is a silent non-delivery, which is the exact failure this flow must
    // never record as a success, so route it through the same release path.
    if (res?.skipped) throw new Error(`not sent: ${res.skipped}`)
    return { ok: true, code }
  } catch (err) {
    // Release the claim. Without this the row reads "sent" forever and the
    // rider never gets the code they were told they had earned.
    await sb
      .from('ride_feedback')
      .update({ reward_sent_at: null, reward_code: null })
      .eq('id', feedbackId)

    console.error('[surveyReward] send failed', err?.message)
    await recordAlert(sb, {
      kind: 'survey_reward_failed',
      severity: 'warning',
      subject: `Survey reward email failed for ${email}`,
      body: `They finished the survey and were promised ${code}. The send threw:\n\n${err?.message || err}\n\nThe claim was released, so a resubmit will retry — but they will not resubmit. Send it by hand.`,
      context: { flow: 'survey_reward', feedback_id: feedbackId, email },
    })
    return { ok: false, error: err?.message || String(err) }
  }
}
