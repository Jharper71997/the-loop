# Privacy and data deletion requests (runbook)

Requests arrive by email to the privacy contact in `lib/legal.js` (today
jacob@jvillebrewloop.com), either from the form at `/privacy/request`
(subject starts `Privacy request:`) or written directly. Replying goes to the
requester because the form sets reply-to.

Deadlines we publish on `/privacy/request`: confirm within **10 days**, finish
within **30 days**.

## 1. Log it
Add a row to a private "Privacy requests" sheet: date received, name, email,
phone, request type, date confirmed, date completed, what was deleted, what was
kept and why. Keep the sheet; it is the evidence we honoured the request.

## 2. Confirm and verify
Reply from the inbox: "Got your request, we'll finish it by <date>." Verify the
person controls the email or phone on file before changing anything:
- the request came from the email on the contact record, or
- they reply from it, or
- for phone-only riders, text them a one-time code from the SimpleTexting
  inbox (a manual, one-off message in reply to their request) and ask them to
  send it back by email.
Never delete on an unverified request. Never send data to an unverified email.

## 3. Find the records
Look the person up by phone (E.164, `+1XXXXXXXXXX`) and email in Supabase:
- `contacts` (the rider), then everything keyed to `contacts.id`:
  `group_members`, `order_items` (contact_id), `orders` (buyer contact),
  `waiver_signatures`, `ride_feedback`, `event_waitlist`, `loop_passes`,
  `push_subscriptions`, `security_messages`, `bartenders` (if a bartender).
- `webhook_events.payload` holds raw Stripe events, which include name, email
  and billing address. Search the JSON for their email.
- SimpleTexting contact (by phone), Stripe customer (by email), Ticket Tailor
  orders (older bookings), Resend logs.

## 4. Act
**Access:** export the rows above to a CSV/PDF and email it to the verified
address.

**Correct:** update the fields.

**Stop texts:** set `contacts.sms_consent = false` and opt the number out in
SimpleTexting (Contacts, unsubscribe). STOP replies already opt out in
SimpleTexting, but do NOT sync back to `contacts.sms_consent` today.

**Delete:**
1. Delete or anonymise: `ride_feedback` (null out name/phone/email/comment),
   `event_waitlist`, `push_subscriptions`, `security_messages`, marketing
   opt-ins, the SimpleTexting contact, and the rider's own contact fields
   where no retained record depends on them.
2. Keep, but only as long as needed: paid `orders`/`order_items` (tax and
   accounting, typically 7 years is a common retention period; confirm with the
   bookkeeper) and `waiver_signatures` (possible liability claims; confirm the
   retention period with counsel). Where you keep an order, strip what is not
   needed for the books (for example rider phone/email on non-buyer seats).
3. Stripe: Dashboard, Customers, the customer, "Delete customer" if no
   subscription or dispute is open. Cancel any Loop Pass first.
4. Ticket Tailor: request deletion through their support if they hold the
   person's orders.
5. Purge matching `webhook_events` rows older than any open dispute window.

All of this is a manual write against the live database (local and prod are
the SAME Supabase project). Do it deliberately, one person at a time.

## 5. Close it
Reply with what was deleted, what was kept, why, and until when. Fill in the
completion date in the sheet.
