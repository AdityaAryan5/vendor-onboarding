# Accord — vendor onboarding demo

M1–M4 plus M6 checkpoint. Stopped before M5. Next.js App Router + TypeScript + Tailwind + shadcn-style UI, PostgreSQL/Drizzle, JavaScript PDF extraction and optional development-only OCR. No AI API key or paid service is required.

## Run on your Mac

Install Node.js **22.13+ or 24**, then run inside the extracted `vendor-onboarding` directory:

```bash
npm ci
cp .env.example .env
npm run dev
```

Keep your existing `.env` if already configured. Open **http://localhost:3000**. The dev launcher starts real embedded PostgreSQL if needed, applies migrations, and seeds existing vendor records plus nine completed synthetic historical cases. No Homebrew packages are needed for text PDFs. macOS setup is documented; automated checks here ran on Linux.

Optional local scan reading:

```bash
brew install poppler tesseract
npm run doctor
```

Without these tools, image-only PDFs go to Pending Reviewer. Production never invokes native OCR. Source labels are **PDF text extraction**, **Local OCR**, and **Cached extraction used**. None is labelled AI.

## Public link

Follow **[DEPLOYMENT.md](DEPLOYMENT.md)** for Neon Free + Vercel Hobby. It includes exact commands, environment variables, migration/seed instructions and a public-access check. This archive is **deployment-ready; no public deployment is claimed**. Vercel/Neon accounts are required. The interview demo should remain personal/non-commercial and use synthetic input only.

## Demo M3

1. In a fresh workspace, choose **S2 · Wrong bank document** and submit.
2. The bank slot contains a GST certificate: Pending Vendor, with the specific replacement request. Dependent bank checks are blocked.
3. Click **Open saved case** → **Attach S2 corrected bank proof** → **Resubmit this case**.
4. The same tracking ID now has revision 2, Approved. GST and PAN document bytes are retained and may reuse actual cached evidence. Every policy and record check runs again.
5. Open **Revision 1 · preserved** to see the original pending decision and wrong document. The audit timeline keeps both decisions and the correction event.

Submitting the same scenario as another NEW case intentionally triggers duplicate-identity review. For the resubmission demo, always correct the original case. Tests use disposable databases so expected outcomes stay repeatable. The Scenario Runner remains a future milestone. Reviewer actions are available in M4.

## M6 demo (implemented before M4 at your request)

| Scenario | Result | Dashboard evidence |
| --- | --- | --- |
| S6 | REJECTED | `blocklist`: active entry `seed-bank-block`, match type, internal reason; vendor gets a safe policy message |
| S5 | PENDING_REVIEWER | `bank_duplicate`: Beacon / `seed-duplicate`, Approved status, masked account; newly approved cases are also checked |
| S7 | REJECTED | `gst_checksum`: supplied versus expected check character; policy rule, not a fraud finding |
| S8 | REJECTED | `country`: submitted US versus supported IN; no record lookup |

In the Dashboard, the **Rule & match** column identifies each finding. Open the case to see the internal evidence cards and every persisted check. S6, S5, S7 and S8 each have their own completed historical seed; the original approved/pending-vendor/rejected examples remain. Historical outcomes are snapshots and are never rewritten when policy or records change.

To correct S7: submit S7, open its saved vendor case, click **Load S7 corrected GSTIN and certificate**, then **Resubmit this case**. The same case becomes Approved when all checks pass; revision 1 remains Rejected. Corrected fixture files are included in `test_data` and regenerate with the fixture script.

Vendor status and polling responses omit internal match details. Switch to Reviewer to open cross-session case details and internal matches; vendor sessions receive 403 from reviewer APIs.

## M4 reviewer demo

1. Submit S3 as Vendor, then switch the header role to **Reviewer**. The server assigns **Priya Shah (demo reviewer)**; client-supplied actor names are ignored.
2. Open **Review queue**. It shows pending findings, owner and age. Open S3 to compare declared PAN, GSTIN-embedded PAN and PAN-card PAN. S3-state compares state evidence; S5 shows the matched internal vendor.
3. **Approve** requires an overall note and a resolution note for every current review finding. Hard rejection, missing mandatory evidence, unreadable/unreliable extraction and outstanding vendor corrections block approval. Current internal records are rechecked when acting.
4. **Reject** requires a note. **Request more info** requires an internal note, a separate vendor-visible DRAFT message, and selected fields/documents. It moves the case to Pending Vendor. Switch back to Vendor to correct those items on the same case.
5. The decision card identifies human review. The audit timeline preserves actor, timestamp, previous/new state and note; the original automated decision and checks remain stored. Internal notes are withheld from vendor responses.
6. Dashboard records VND-DEMO-0008 and VND-DEMO-0009 show seeded reviewer approval and rejection, respectively.

Every reviewer API validates the signed cookie server-side. Actions lock the case and reference both its current revision and decision; stale requests return 409. Matching idempotency retries return the same decision without appending another action. Reviewer actions and audit events are append-only. API actions finish within the request lifetime.

**Demo authentication limitation:** anyone visiting this synthetic demo can use the role switch. It proves role enforcement, not the identity or authorization of a real procurement employee. The reviewer name is a fixed demo persona. Do not use this toggle for real vendor data. Real deployments need authenticated accounts and assigned roles.

The future Scenario Runner has a separate, server-selected quota category: `RATE_LIMIT_RUNNER=60` per IP/minute, or `0` to exempt authenticated demo-reviewer runner calls. No client header can select or bypass this quota. The Scenario Runner itself is not built in M4; existing submission APIs retain their normal limits.

## Public-demo limits

- Each PDF: 1,000,000 bytes maximum; all PDFs in a revision: 3,000,000 bytes; PDF page limit remains 15.
- Multipart request body: 3,100,000 bytes, counted while reading even without Content-Length. Oversize requests return 413 before workflow creation.
- Per IP, per fixed minute: 20 submissions/corrections, 30 session starts, 1,200 protected reads (dashboard, detail, polling). Exceeded quotas return 429 with Retry-After. Counters are atomic in Postgres and shared across instances; only keyed hashes of IP addresses are stored. Expired buckets are cleaned up.
- Vercel's platform forwarding header supplies the address. On direct local hosts, client forwarding headers are ignored and a shared fallback bucket is used. Only enable `TRUST_PROXY_IP=true` behind your own trusted proxy that overwrites the header and prevents direct origin access.
- These are basic demo safeguards, not DDoS protection. Shared NAT users share a quota; distributed IPs can evade a per-IP limit. Rate-limit storage failure returns 503 instead of accepting unlimited work.

## Current behavior

- Seven persisted execution stages; ordinary status polling every ~400 ms. `STAGE_MIN_DISPLAY_MS=500` keeps stages visible, configurable from 0–2000 ms. Stage duration shows actual work, not the display delay. No SSE.
- `DEMO_WORKSPACE=true` exposes dashboard summaries across demo sessions, with the synthetic-data banner. Internal case details and actions require the signed demo reviewer role. Vendor status, run status and correction APIs stay owner-session scoped. This is deliberately a **public synthetic workspace**, not real procurement authentication.
- With demo mode off, dashboard history is session scoped; hosted non-demo access requires `DEMO_ACCESS_PASSWORD`.
- Resubmission accepts only fields/documents requested by vendor findings or correctable country/checksum rejection rules. Reviewer-only findings cannot be silently resolved by a vendor; a reviewer can explicitly request fields/documents for correction. Stale revisions return 409; concurrent retries create one revision/run. No-action resubmissions are rejected.
- Code determines status. Name normalization handles case, punctuation, pvt/private, ltd/limited; other name differences go to human review. No LLM similarity assessment is performed.
- The cache contains extraction evidence only, keyed by file SHA-256 + extractor version + schema version. Fresh uploaded files are read first. Actual cached evidence can be reused for unchanged documents or after extraction failure. Rules and database checks always run live.
- Nine historical seed cases are generated from actual synthetic PDFs and evaluated at startup. They have distinct identifiers from S1–S9. They are explicitly marked as historical examples, not simulated live runs.
- Account numbers are strings, masked in returned results, and matched using a keyed HMAC. Messages are DRAFTS; no email is sent.

## Tests

Run sequentially (avoid starting the dev server while a production build generates its types):

```bash
npm test
npm run test:m1
npm run test:integration
npm run build
npm run test:hosted
npm run test:m3
npm run test:limits
npm run test:m6
npm run test:m4
```

- Unit tests: all policy rules, independent GSTIN fixture checks, parsing and cache gates, requested correction scope.
- M1: real Postgres migrations and idempotent seed.
- M2 integration: persisted stages, fresh extraction, masking, session ownership, idempotency and immutable audit log.
- Hosted/M3: production Next server with DATABASE_URL and no binaries on PATH; S1–S4; a newly generated changed-name PDF; S9 scan; shared dashboard/private vendor APIs; two-revision S2; concurrent correction retries; stale/unrequested/other-session edits; a blocklist entry added between revisions.
- `npm run test:local` additionally verifies native OCR when Poppler/Tesseract are installed. `npm run generate-test-data` regenerates fictional PDFs and scenario JSON fixtures; expected fixture evidence is a test oracle, not a replacement for reading files.

## Limits to explain in the interview

English printed, labelled documents are supported. This parser is narrower than an LLM; ambiguous fields, missing text, unusual layouts or low-confidence OCR require review. Confidence is a conservative heuristic, not a calibrated probability. Uploads are limited to 15 pages per PDF and 1 MB per PDF, 3 MB per revision. The app does not verify government registries or bank ownership.

Sessions last 24 hours; no account recovery or real reviewer identity verification. A Vercel `after` task is bounded by the function timeout, not a durable job queue. Runs older than 75 seconds are marked technically failed on the next authorized status/detail read, with one audit event; saved decisions remain intact. The job has a cooperative 45-second work budget and 10-second database statement timeout inside the 60-second function window. This is not an automatically retried durable queue. Postgres holds PDF bytes for this small synthetic demo. Use external object storage and stronger authentication before adapting it to real vendors.

**Checks cover format, consistency, and internal records only. They do not prove a company or bank account is legitimate.**

## Main files

- `config/countries/india.ts`: versioned India policy and supported scope.
- `lib/local-reader.ts`, `lib/native-reader.ts`, `lib/extract.ts`: JavaScript extraction, optional local OCR, schema gate and cache.
- `lib/workflow.ts`, `lib/resubmit.ts`, `lib/corrections.ts`: execution, persistence and restricted same-case corrections.
- `lib/db/`, `migrations/`: hosted Postgres, migrations and idempotent seed.
- `app/api/`: submission, status polling, private vendor detail and correction routes.
- `app/page.tsx`, `components/correction-panel.tsx`: form, live view, dashboard and revision timeline.
- `scripts/verify-hosted.ts`: repeatable HTTP regression rehearsal.

## Optional Gemini document extraction

No key is required. To opt in, set `GEMINI_API_KEY` in your private `.env` or host secrets, `GEMINI_ENABLED=true`, `GEMINI_MODEL=gemini-3.5-flash-lite`, and `GEMINI_HOURLY_CAP=30`. Setting `GEMINI_ENABLED=false` or leaving the key blank retains local-only behavior. Never commit or log the key. The default model is Google's current stable, low-latency Flash-Lite model for PDF parsing, with free input/output on its free tier ([model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [pricing](https://ai.google.dev/gemini-api/docs/pricing)). Provider access/quotas vary; this app does not enable billing or guarantee free usage on a billed account.

Gemini receives PDF bytes, requests strict JSON derived from the existing Zod schema at temperature 0, and validates the response with that same schema. It only reads/classifies documents; code still decides status. Valid evidence below 0.7 confidence remains pending reviewer, never replaced with higher-confidence cached evidence. Gemini has a 7-second timeout per document. On API, schema, timeout, 429 or cap failure: try validated cached evidence (model/version-specific Gemini cache, then local cache), then the JS PDF parser/optional development OCR. Exhausted extraction routes to human review; corrupt PDFs retain the existing vendor-correction rule. Cache hits say “Cached extraction used”; local extraction after Gemini failure says “Parser (fallback)”. No AI is claimed for parser output. Without Gemini, the existing local extraction/cache behavior is unchanged.

The app-wide cap counts outbound attempts, including failed ones, atomically across all instances sharing the database, in fixed UTC clock hours. It reuses the existing request-limit table without migration; 0 disables outbound calls, and counter-storage failure also prevents calls. Scenario Runner cases (including their corrected revisions) bypass Gemini and its cache entirely, always using local evidence without consuming Gemini quota. Seed generation also stays local.

**Free-tier privacy:** Google may use free-tier prompts, uploaded documents and responses to improve its products, and human reviewers may process that content under Google's terms. Only upload fictional/synthetic documents when Gemini is enabled—never real vendor, banking, tax or personal information. See [Google's terms](https://ai.google.dev/gemini-api/terms) and [pricing/data-use table](https://ai.google.dev/gemini-api/docs/pricing).
