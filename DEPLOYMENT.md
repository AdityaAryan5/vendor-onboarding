# Free public demo: Vercel Hobby + Neon Free

Status: prepared and tested locally in production mode. **Not deployed to Vercel or Neon.** You need your own free accounts; no AI API key is needed. This personal, non-commercial interview demo fits the intended Hobby use. Free plans have usage/storage limits; keep all input synthetic.

## 1. Prepare Neon

Create a Free project at https://console.neon.tech. Choose a region near your Vercel region. In **Connect**, copy the Postgres connection string with pooling enabled, and a second string with pooling disabled. Retain `sslmode=require` and any parameters Neon supplies. Do not disable TLS verification.

Use Node.js 22.13+ or 24. From the extracted `vendor-onboarding` directory:

```bash
npm ci
cp .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep an existing `.env` rather than replacing it. Set these values in `.env` (never commit it):

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon's pooled Postgres URL |
| `DIRECT_DATABASE_URL` | Neon's direct URL, for migrations and seeding; optional if using a direct DATABASE_URL |
| `BANK_HASH_KEY` | First generated secret; keep stable or existing bank hashes will no longer match |
| `SESSION_SECRET` | Second generated secret; changing it invalidates sessions |
| `DEMO_WORKSPACE` | `true` |
| `STAGE_MIN_DISPLAY_MS` | `500` |
| `OCR_ENABLED` | `false` (production always disables native OCR regardless) |
| `DEMO_ACCESS_PASSWORD` | Leave empty for the public synthetic workspace; optional password if desired |

Run **the exact same startup migrations and seed routine** against Neon:

```bash
npm run db:setup
npm run build
npm start
```

Open http://localhost:3000. `db:setup` reads `.env`. Migrations are ordered SQL files, tracked in `app_migrations`, with an advisory transaction lock. Seeding is idempotent. Startup also runs this routine, so a new instance does not need a separate migration server. Do not edit previously applied migrations. `npm start` never starts embedded Postgres.

## 2. Create and deploy the Vercel project

```bash
npx vercel login
npx vercel link
```

Create a new project in your personal Hobby account, use the current directory as the root, choose Next.js, Node.js 24.x (or supported 22.13+), build command `npm run build`, and standard Next.js output. Do not configure a static export. Keep Fluid Compute enabled.

Add each Production environment variable interactively. Paste only the requested value at its prompt:

```bash
npx vercel env add DATABASE_URL production
npx vercel env add DIRECT_DATABASE_URL production
npx vercel env add BANK_HASH_KEY production
npx vercel env add SESSION_SECRET production
npx vercel env add DEMO_WORKSPACE production
npx vercel env add STAGE_MIN_DISPLAY_MS production
npx vercel env add OCR_ENABLED production
```

Use the same values as `.env`. For a password-gated demo, also run `npx vercel env add DEMO_ACCESS_PASSWORD production`. Keep that variable unset for the public synthetic demo.

Deploy:

```bash
npx vercel --prod
```

The CLI prints the actual production URL. Only then is the app deployed. In Vercel **Settings → Deployment Protection**, ensure the production domain is publicly accessible if you want interviewers to open it without a Vercel login. Open it in a private browser window to verify access. The root `.vercelignore` excludes local secrets, embedded database files and test logs from uploads.

## 3. Rehearse on the real URL

1. Confirm the synthetic-data banner and nine historical cases.
2. Submit S1. Observe seven stages; final outcome must be Approved.
3. Submit S2. Open its saved vendor case, attach the corrected bank proof, and resubmit. The tracking ID must stay the same, with two revisions.
4. Submit S3/S4: Pending Reviewer. Switch to Reviewer, open the review queue, resolve every finding and provide a note. S3-state and S5 also support review. The demo role switch is public, not real employee authentication.
5. Submit S9: Pending Reviewer, with “Scanned file; OCR unavailable in this environment.”
6. Open a second private session: dashboard history is shared; the vendor `/?case=...` page remains private to its original session.

Polling uses ordinary GET requests every ~400 ms. Mutating POST routes schedule execution with Next.js `after`, supported by Vercel and a running Next.js Node server; serverless adapters must support `waitUntil`. Each run has a 60-second function budget. This is a bounded demo workflow, not a durable distributed job queue. A host killing a function cannot be treated as a completed job. On the next authorized poll/detail read, a queued/running job older than 75 seconds is marked failed and audited once; no rejection is invented. The callback checks a 45-second work budget between stages and documents; database statements have a 10-second timeout. This cooperative budget cannot interrupt a CPU-bound PDF parse, so the platform limit remains the hard boundary.

PDF.js reads new text PDFs in JavaScript; production never invokes Poppler/Tesseract or embedded Postgres. Optional native canvas packages are excluded from deployment traces, and no canvas rendering is used. Uploaded PDF bytes are stored in Postgres for this small demo (1 MB per PDF, 3 MB combined per revision, 15 pages per PDF), so avoid repeated large uploads on the free storage allowance. Scans need reviewer handling on Vercel. No external identity or bank verification is claimed.

## Automated production-style rehearsal

```bash
npm run build
npm run test:hosted
```

This launches a real disposable local PostgreSQL server in the **test harness only** and gives the production app a `DATABASE_URL`. The app process has no native tools on PATH. It tests HTTP submissions, polling, fresh modified PDF bytes, session isolation and demo seeding. It does **not** claim that a Neon network connection or a Vercel deployment has been tested.

References (checked November 2026):
- https://vercel.com/docs/plans/hobby — free personal/non-commercial plan and limits.
- https://vercel.com/docs/cli/deploy — production deployment CLI.
- https://neon.com/pricing — Free plan, no credit card required.
- https://neon.com/docs/connect/connection-pooling — pooled/direct connection strings.
- https://nextjs.org/docs/app/api-reference/functions/after — server lifetime support.

## Execution lifetime and public limits (M6)

Both initial submission and correction POST routes export `maxDuration = 60`. They first commit a queued run and return JSON `202`; their `after(() => executeRun(...))` callback returns the **awaited workflow promise** to Next.js. Vercel keeps that invocation alive through its `waitUntil` integration after the response. It is not an untracked background promise, and polling never launches another run. Atomic queued→running claims prevent concurrent retries from executing a run twice. Every stage/check is persisted, so connection loss does not discard progress.

The configured assumption is **60 seconds total invocation time**, including `after` work, rather than relying on a larger plan default. Vercel currently lists a 300-second Hobby Fluid limit, but this app deliberately requests 60. A cold start or slow upload reduces the remaining time. Jobs that cannot finish in that window need a durable queue in a later milestone; this checkpoint detects and reports the interruption, it does not promise automatic recovery.

Limits require no paid service: PostgreSQL stores atomic per-IP minute buckets. Optional environment overrides (positive integers, capped at 2,000) are `RATE_LIMIT_WRITE=20`, `RATE_LIMIT_SESSION=30`, `RATE_LIMIT_READ=1200`. Keep defaults for public rehearsal. Do not set `TRUST_PROXY_IP` on Vercel; platform IP headers are used automatically. Direct local hosting deliberately groups unknown addresses into one bucket rather than trusting user headers. PDF limits are 1 MB each / 3 MB combined, and request buffering is capped at 3.1 MB even for chunked uploads.

Additional references:
- https://vercel.com/docs/functions/configuring-functions/duration
- https://vercel.com/docs/headers/request-headers

M4: reviewer APIs enforce signed session roles. Set `DEMO_WORKSPACE=true` for the public synthetic role switch. `RATE_LIMIT_RUNNER=60` reserves a separate quota for the future authorized Scenario Runner (`0` exempts that category only). Keep ordinary write limits enabled. Run `npm run db:setup` against Neon to apply migration 0006 and add the two reviewed historical cases; startup also does this idempotently.
