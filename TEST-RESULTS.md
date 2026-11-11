# M4 verification — 11 November 2026

- Unit tests: **104 passed, 6 files** (including 14 reviewer-policy tests and runner quota authorization/exemption).
- PostgreSQL migration/seed test: **PASS**, 6 migrations, 4 existing vendors, 1 blocklist entry; idempotent setup.
- Production build and TypeScript: **PASS**.
- Production trace: **PASS**, PDF.js worker included; embedded Postgres and native canvas excluded.
- M4 production HTTP: **PASS** (output below).
- M3 regression: **PASS**, including same-case correction, changed PDF read fresh, S1–S4 and scan fallback. Polling observed 6/7 running stages on one S3 run; all seven stages completed and persisted. Running-state sampling is not guaranteed under scheduler delay.
- M6 regression: S6, S5 and S7 passed; S8 also passed when rerun separately after an overlapping build interrupted its initial server startup.
- Browser: demo role switch, queue, duplicate record, disabled approval until required notes, then saved reviewer approval and audit verified.

Production tests use `NODE_ENV=production`, `DATABASE_URL`/`DIRECT_DATABASE_URL` pointing to disposable real PostgreSQL, `PATH=/no-native-binaries`, and a native-canvas blocker. This is production-style local verification, not a Neon/Vercel deployment. HTTP tests raise write quotas to avoid throttling their own fixture batches.

```text
PASS M4 role: vendor and forged role header -> 403; signed reviewer session -> 200; named actor supplied by server; switching preserves vendor ownership
PASS M4 seeds: reviewer-approved and reviewer-rejected histories preserve automatic decisions, resolutions, actor and audit.
PASS M4 queue/evidence: S3 form PAN vs embedded PAN vs PAN card; reviewer owner + age; all reviewer endpoints reject vendor sessions
PASS M4 reject: named actor, note, old/new state and timestamp persisted; double-click appends once; internal note withheld from vendor
PASS M4 request info: vendor-safe DRAFT, PENDING_VENDOR, only requested edits allowed; same-case revision 2; stale revision and stale decision blocked
PASS S3 reviewer approval: every current finding resolved with its own note
PASS S3-state: visible state evidence -> deliberate reviewer approval -> APPROVED
PASS S5: visible bank_duplicate evidence -> deliberate reviewer approval -> APPROVED
PASS approval gates: hard rejection, missing mandatory PAN evidence, and newly added live blocklist entry cannot be overridden
M4 PRODUCTION HTTP PASSED: no OCR binaries, signed-role enforcement, queue, actions, complete audit, stale/idempotency and evidence gates.
```

Reproduce M4 after `npm ci`: `npm test`, `npm run build`, `npm run test:m4`. Launch: `npm run dev`. README includes role limitations and demo steps.

---

# Validation — M6 checkpoint

Verified November 11, 2026. M1–M3 plus M6; stopped before M4. No Vercel/Neon deployment was performed.

## Production execution

POST commits the run, returns 202, and returns the workflow promise from Next.js `after()`. On Vercel, this is tracked by `waitUntil` within the invocation lifetime. Both mutation routes explicitly export maxDuration=60. Polls only read persisted progress and expire stale runs; they do not start jobs.

Cooperative work budget: 45 seconds. PostgreSQL statement timeout: 10 seconds. Stale queued/running run: marked failed on the next authorized status/detail request after 75 seconds, audited once. A technical failure never invents a business rejection. This is bounded serverless work, not an automatically retried durable queue.

## Environment and test scope

Production Next.js server, NODE_ENV=production, DATABASE_URL and DIRECT_DATABASE_URL pointing to a real disposable local PostgreSQL server. PATH=/no-native-binaries. A test preload rejects native canvas loads; OCR_ENABLED=true deliberately verifies that production still skips native OCR. No AI API key or OCR binary was used.

The test harness alone starts PostgreSQL. Deployment traces exclude embedded Postgres and native canvas, and include the PDF.js worker. This is a production-style local test, not proof of a live Vercel deployment or Neon network connectivity.

The M6 tests ran sequentially S6 → S5 → S7 → S8. They assert persisted decisions, safe vendor projections, internal match records, masked accounts, rule findings in dashboard responses, and completed seeds. S5 additionally detects a newly approved case. S6 additionally ignores an inactive entry. S7 corrects its GSTIN and certificate on the same case while preserving the rejection.

No new browser visual rehearsal was performed for the M6 dashboard changes; its data and access projections were tested through HTTP, and the production build/type checks passed. M3 previously had a successful browser rehearsal.

## Actual test output

```text
 Test Files  5 passed (5)
      Tests  89 passed (89)
M1 REAL POSTGRES PASS: { vendors: 4, cache: 0, blocks: 1, migrations: 5 }
M2 INTEGRATION: 17 assertions passed
PASS: masking, owner isolation, idempotency, append-only audit, unrecognized document requires review, corrupt PDF.
PASS production bundle: 11 server traces; PDF.js worker included; embedded Postgres and native canvas excluded.
PASS S6: REJECTED; exact active blocklist match + internal reason persisted; safe vendor draft; internal evidence omitted from vendor/status APIs
PASS S6 inactive entry ignored; earlier rejection preserved and does not automatically blocklist the new submission
PASS S6: completed demo seed + dashboard rule/match; production mode, no OCR binaries, native canvas blocked
PASS S5: PENDING_REVIEWER; different approved vendor Beacon/seed-duplicate shown internally; account masked; vendor output safe
PASS S5 live records: a newly approved case is also detected via keyed bank hash
PASS S5: completed demo seed + dashboard rule/match; production mode, no OCR binaries, native canvas blocked
PASS S7: REJECTED with policy/not-fraud note; corrected GSTIN + certificate -> APPROVED on SAME case; rejection, old evidence and audit preserved
PASS S7: completed demo seed + dashboard rule/match; production mode, no OCR binaries, native canvas blocked
PASS S8: REJECTED; country rule records US vs supported IN; clear scope message, no invented record match
PASS S8: completed demo seed + dashboard rule/match; production mode, no OCR binaries, native canvas blocked
PASS S1: APPROVED; PDF text extraction; 7/7 running stages observed by polling
PASS S2: PENDING_VENDOR; PDF text extraction; 7/7 running stages observed by polling
PASS M3 S2: SAME case/tracking ID; revision 1 PENDING_VENDOR -> revision 2 APPROVED; 2 cached unchanged PDFs; both decisions + audit preserved
PASS M3 guards: unrequested field 400; concurrent double-click one revision/run; stale revision 409; retry idempotent
PASS S3: PENDING_REVIEWER; PDF text extraction; 7/7 running stages observed by polling
PASS S4: PENDING_REVIEWER; PDF text extraction; 7/7 running stages observed by polling
PASS modified PDF: new name actually extracted -> PENDING_REVIEWER (name finding), no cache
PASS S9: scanned PDF without OCR -> PENDING_REVIEWER; exact unavailable message
PASS vendor status and run status: cross-session access denied
PASS demo workspace: shared internal dashboard + completed approved/pending/rejected seeds
PASS M3: cross-session correction denied; newly added blocklist entry checked live on revision 2 -> REJECTED
PASS lifetime: stalled invocation becomes FAILED, audit once, no fabricated rejection
PASS abuse controls: 1 MB PDF limit -> 413; persisted per-IP quota -> 429 + Retry-After; spoofed headers do not reset quota
PRODUCTION-STYLE HTTP VERIFICATION PASSED: NODE_ENV=production; PATH has no binaries; DATABASE_URL + DIRECT_DATABASE_URL set. Real local PostgreSQL, not a Neon deployment.
```

The production build also compiled successfully and passed TypeScript. Reproduce after `npm ci` and setting up `.env`:

```bash
npm test
npm run test:m1
npm run test:integration
npm run build
node scripts/verify-production-bundle.mjs
npm run test:m6
VERIFY_WORKSPACE=true VERIFY_M3=true VERIFY_LIMITS=true node --import tsx scripts/verify-hosted.ts
```

## Public demo protections

1 MB maximum per PDF, 3 MB combined, 3.1 MB streamed body cap, 15 pages per PDF. Default per-IP fixed-minute quotas: 20 mutations, 30 session starts, 1,200 protected reads. Counters are atomic/shared in PostgreSQL with keyed IP hashes, short retention and Retry-After on 429. Limits also apply before invalid submissions are parsed. Rate-limit database errors fail closed with 503. Forwarding headers are trusted only on Vercel or when an explicitly trusted proxy is configured.

M4 now enforces reviewer roles server-side. Vendor detail and polling omit internal record entries/reasons. Anyone can assume the demo reviewer role through the synthetic role switch; this is not real employee authentication.
