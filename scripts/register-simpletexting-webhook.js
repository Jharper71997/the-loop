// Register (or update) the SimpleTexting webhook that feeds /admin/messages.
//
// Run AFTER the sms-sync branch is deployed and SIMPLETEXTING_WEBHOOK_SECRET is
// set in Vercel Production, with the SAME secret available locally:
//
//   node scripts/register-simpletexting-webhook.js --dry-run
//   node scripts/register-simpletexting-webhook.js
//   node scripts/register-simpletexting-webhook.js --base=https://the-loop-eight.vercel.app
//
// Env (process env first, then .env.local): SIMPLETEXTING_API_KEY,
// SIMPLETEXTING_WEBHOOK_SECRET, optional SIMPLETEXTING_PHONE.
//
// Idempotent: if a webhook already points at /api/simpletexting-webhook it is
// updated in place (PUT) instead of creating a second one, so re-running never
// doubles every delivery. Sends no texts. The secret is never printed.
//
// Default base is the vercel.app alias, not the apex domain: the apex is a DNS
// record that has pointed at Squarespace before (same reason pg_cron uses it).

const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const baseArg = args.find(a => a.startsWith('--base='))
const BASE = (baseArg ? baseArg.slice(7) : 'https://the-loop-eight.vercel.app').replace(/\/+$/, '')
const ROUTE = '/api/simpletexting-webhook'
const API = 'https://api-app2.simpletexting.com/v2/api'
const TRIGGERS = [
  'INCOMING_MESSAGE',      // rider replies
  'OUTGOING_MESSAGE',      // every send, incl. ones typed in SimpleTexting's own inbox
  'DELIVERY_REPORT',       // carrier says delivered
  'NON_DELIVERED_REPORT',  // carrier says not delivered
  'UNSUBSCRIBE_REPORT',    // STOP, or blocked in the SimpleTexting UI
]

const key = process.env.SIMPLETEXTING_API_KEY
const secret = process.env.SIMPLETEXTING_WEBHOOK_SECRET
if (!key) { console.error('SIMPLETEXTING_API_KEY missing'); process.exit(1) }
if (!secret || secret.length < 24) {
  console.error('SIMPLETEXTING_WEBHOOK_SECRET missing or shorter than 24 chars. Generate one with:')
  console.error("  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"")
  process.exit(1)
}

const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' }
const url = `${BASE}${ROUTE}?token=${encodeURIComponent(secret)}`
const shown = `${BASE}${ROUTE}?token=<redacted>`

const body = { url, triggers: TRIGGERS, requestPerSecLimit: 10 }
const digits = String(process.env.SIMPLETEXTING_PHONE || '').replace(/\D/g, '')
if (digits) body.accountPhone = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits

;(async () => {
  // 1. Is the endpoint live and guarded? An unauthenticated POST must be a 401.
  try {
    const probe = await fetch(`${BASE}${ROUTE}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', redirect: 'manual' })
    const pj = await probe.clone().json().catch(() => ({}))
    if (probe.status === 401 && pj.error === 'webhook_secret_unset') { console.error('endpoint check: SIMPLETEXTING_WEBHOOK_SECRET is not set on this deployment. Set it in Vercel, redeploy, then re-run. Aborting.'); process.exit(1) }
    if (probe.status === 401) console.log(`endpoint check: ${BASE}${ROUTE} is live and rejects unauthenticated calls (401)`)
    else if (probe.status === 307 || probe.status === 308) { console.error(`endpoint check: got ${probe.status} redirect. The route is not in PUBLIC_PREFIXES on this deployment. Aborting.`); process.exit(1) }
    else if (probe.status === 404) { console.error('endpoint check: 404. The sms-sync branch is not deployed here yet. Aborting.'); process.exit(1) }
    else console.warn(`endpoint check: unexpected status ${probe.status}; continuing`)
  } catch (err) {
    console.error(`endpoint check failed: ${err.message}. Aborting.`); process.exit(1)
  }

  // 2. Existing webhooks.
  const existing = []
  for (let page = 0; page < 10; page++) {
    const res = await fetch(`${API}/webhooks?page=${page}&size=50`, { headers })
    if (!res.ok) { console.error(`GET /webhooks ${res.status}: ${(await res.text()).slice(0, 200)}`); process.exit(1) }
    const j = await res.json()
    existing.push(...(j.content || []))
    if (page + 1 >= (j.totalPages || 0)) break
  }
  console.log(`SimpleTexting has ${existing.length} webhook(s) today`)
  const ours = existing.filter(w => String(w.url || '').includes(ROUTE))
  if (ours.length > 1) console.warn(`warning: ${ours.length} webhooks already point at ${ROUTE}; updating the first, delete the rest in SimpleTexting settings`)
  const target = ours[0]

  console.log(`${target ? 'UPDATE ' + target.webhookId : 'CREATE'} -> ${shown}`)
  console.log(`triggers: ${TRIGGERS.join(', ')}${body.accountPhone ? ` · accountPhone ${body.accountPhone}` : ''}`)
  if (dryRun) { console.log('dry run: nothing changed'); return }

  const res = target
    ? await fetch(`${API}/webhooks/${target.webhookId}`, { method: 'PUT', headers, body: JSON.stringify(body) })
    : await fetch(`${API}/webhooks`, { method: 'POST', headers, body: JSON.stringify(body) })
  const txt = await res.text()
  if (!res.ok) { console.error(`${target ? 'PUT' : 'POST'} failed ${res.status}: ${txt.slice(0, 300)}`); process.exit(1) }
  console.log(`done (${res.status}) ${txt.slice(0, 200)}`)
  console.log('Next: text the Brew Loop number from your phone and check /admin/messages.')
})().catch(err => { console.error(err); process.exit(1) })
