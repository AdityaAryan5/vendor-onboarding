# Accord — Vendor Onboarding

A working vendor-onboarding process built for the Zamp AI Solutions Analyst case study, **Problem Statement 2: Vendor onboarding — from submission to approval**.

Accord accepts company details and PDF documents, reads the evidence, applies policy checks, and produces **Approved**, **Pending Vendor**, **Pending Reviewer**, or **Rejected**, with visible reasons and next steps. Corrections stay on the same case, and reviewers can resolve findings with an audit trail.

**AI reads documents. Code makes onboarding decisions.** The application also runs without an AI API key using local PDF extraction.

## Demo links

- **Live application:** https://vendor-onboarding-kappa.vercel.app/
- **Demo video (maximum 5 minutes):** https://drive.google.com/drive/folders/1f-ANG5YSioPeM2kwceCZ1AosQskkGQSq?usp=sharing
- **Source code:** [GitHub repository](https://github.com/AdityaAryan5/vendor-onboarding)

> Replace the two placeholders before submitting. Check that the application and video open without requesting access.

## Supported scope

India only: ordinary PAN-based, GST-registered companies. All demo files and seeded records are fictional. This is a synthetic procurement demo, not a service for verifying real businesses.

> Checks cover format, consistency, and internal records only. They do not prove a company or bank account is legitimate.

## How it works

1. **Completeness:** check required fields, documents, contact email, and supported country.
2. **Read documents:** extract and classify evidence; check readability, document type, and confidence.
3. **Validate fields:** check PAN, GSTIN format/checksum, IFSC, and applicable expiry.
4. **Cross-check evidence:** compare identifiers, registration state, banking details, and names across the form and documents.
5. **Check existing records:** identify existing identities, reused bank accounts, and active blocklist matches.
6. **Decide:** apply deterministic policy precedence.
7. **Communicate:** save a vendor-facing message as a **DRAFT**, never as a sent email.

Decision precedence is **Rejected → Pending Reviewer → Pending Vendor → Approved**. When both pending owners have work to do, both action lists remain visible. Identifier or name discrepancies route to review; they are not fraud findings.

Technical run state is separate from the onboarding decision. A processing failure does not mean rejection. Stages that execute after a hard rejection are labelled **Checked for the record**.

## Interface

| View | Purpose |
| --- | --- |
| Submit | Enter company and bank details, upload GST/PAN/bank PDFs, or load a demo submission. |
| Live run | Follow all seven stages, durations, extraction sources, checks, and the final decision. |
| Vendor case | See the draft message, requested corrections, and preserved revision history. |
| Dashboard | Search/filter cases, open findings and record matches, and view six KPIs. |
| Reviewer queue | Review pending cases with evidence, owner, and age; record a decision with notes. |
| Scenario Runner | Run S1–S8 individually or sequentially and compare actual outcomes with expectations. |
| Policy | Read the rule table generated directly from the versioned India configuration. |

Dashboard KPIs are total cases, auto-approved percentage, pending-vendor count, pending-reviewer count, rejected count, and average completed processing time per case. Auto-approved percentage means current automated approvals divided by all cases; reviewer approvals are excluded from its numerator.

## Demo scenarios

Expected outcomes assume a fresh demo workspace. All scenarios execute the real workflow against current records.

| Scenario | Input or issue | Initial expected outcome |
| --- | --- | --- |
| S1 | Complete submission; standard company-name abbreviations normalize successfully | Approved |
| S2 | GST certificate uploaded instead of bank proof | Pending Vendor |
| S3 | Checksum-valid GSTIN with conflicting embedded PAN | Pending Reviewer |
| S4 | Trading name differs from legal name | Pending Reviewer |
| S5 | Bank account belongs to another approved vendor | Pending Reviewer |
| S6 | Bank account matches an active blocklist entry | Rejected |
| S7 | Correctly formatted GSTIN fails its checksum | Rejected |
| S8 | Unsupported country | Rejected |

Additional fixtures cover a registration-state conflict and a low-quality scan. The Scenario Runner uses the parser, never Gemini, and consumes no Gemini quota. Repeating S1 without resetting can correctly produce Pending Reviewer because its identity already exists; the runner reports the actual mismatch rather than forcing a pass.

### Same-case correction

Submit S2, open its saved case as the submitting Vendor, attach the corrected bank proof, and resubmit. Revision 2 can become Approved while revision 1 remains Pending Vendor. Unchanged documents may reuse cached extraction, but policy and current-record checks run again. S7 also supports correcting the GSTIN and certificate without erasing the original rejection.

The Scenario Runner tests S2's initial submission; the correction loop is demonstrated separately through the vendor submission flow.

### Reviewer workflow

Switch to **Reviewer** in the header. The server assigns the named demo actor **Priya Shah (demo reviewer)**. Open a pending case to compare evidence such as declared PAN, GSTIN-embedded PAN, PAN-card PAN, or a matched internal vendor record.

- **Approve:** requires an overall note and a resolution note for every current review finding. Hard rejection, missing mandatory evidence, unreliable extraction, and outstanding vendor corrections block approval.
- **Reject:** requires a note.
- **Request more info:** requires an internal note, a separate vendor-safe draft message, and selected fields/documents. The case moves to Pending Vendor for correction.

Actions reference the current revision and decision, recheck current records, reject stale requests, and handle idempotent retries. Audit entries preserve actor, timestamp, previous/new state, and note. Internal reviewer notes are withheld from vendor responses.

**Authentication limitation:** anyone can use the role switch in this public synthetic demo. Signed session roles are enforced server-side, but the switch does not establish real employee identity or authorization. Real vendor use requires proper accounts and assigned roles.

### Reset demo workspace

With `DEMO_WORKSPACE=true`, a reviewer can select **Reset demo workspace** in the Scenario Runner and confirm deletion. It removes non-seed cases and their associated revisions, documents, checks, runs, decisions, reviewer actions, and audit history, then reapplies the seed routine. Seeded vendors, blocklist entries, and seed-case history are retained. It does not undo changes made to retained seed cases.

A fresh workspace contains nine historical cases covering approval, both pending owners, rejection, and reviewer-resolved outcomes. Reset uses the existing write rate limit and refuses to run while workflows are queued or running. Audit and reviewer-action history are append-only during normal operation; this explicitly confirmed demo reset is the exception for non-seed history.

## Run locally

Use Node.js **22.13+ or 24**. Inside the project directory:

```bash
npm ci
cp .env.example .env
npm run dev
```

Keep your existing `.env` if configured. Open **http://localhost:3000**. The development launcher starts embedded PostgreSQL when needed, applies migrations, and seeds the database. Text PDFs require no native OCR installation.

Optional development OCR on macOS:

```bash
brew install poppler tesseract
npm run doctor
```

Production never invokes native OCR. Image-only PDFs need human review if neither Gemini nor local OCR can provide usable evidence.

## Optional Gemini extraction

Configure these server-side variables to opt in:

```dotenv
GEMINI_API_KEY=
GEMINI_ENABLED=true
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_HOURLY_CAP=30
```

Leave the key blank or set `GEMINI_ENABLED=false` for local-only behavior. Store real keys only in private environment settings; never commit or log them. The configured default is Flash-Lite for PDF parsing. Check Google's [model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) and [pricing](https://ai.google.dev/gemini-api/docs/pricing) for current access and free-tier availability; the app does not enable billing or guarantee free usage on a billed account.

Gemini receives PDF bytes and requests strict JSON matching the existing extraction schema at temperature 0. Zod validates the response. Valid evidence below 0.7 confidence stays pending reviewer instead of being replaced with more confident cached evidence.

With Gemini enabled, the fallback order is **Gemini → validated cached evidence → local parser → human review if extraction remains unusable**. API errors, malformed responses, 429s, the seven-second timeout, or the app-wide cap trigger fallback. Existing corrupt-file and missing-document rules still apply. Without Gemini, the original local extraction/cache behavior remains unchanged.

The cap counts outbound attempts across instances sharing the database in fixed UTC clock hours. Setting it to 0 prevents calls; unavailable counter storage also prevents calls. Extraction evidence—not decisions—is cached by file hash, extractor/model version, and schema version. Scenario Runner cases and their corrections bypass Gemini and its cache.

Source labels are **AI (Gemini)**, **PDF text extraction**, **Local OCR**, **Cached extraction used**, and **Parser (fallback)**. Parser output is never labelled AI. Name matching uses conservative normalization; there is no AI name-similarity assessment.

**Free-tier privacy:** Google may use free-tier prompts, uploaded files, and responses to improve its products; human reviewers may process this content under its terms. Only synthetic documents should be uploaded when Gemini is enabled—never real vendor, banking, tax, or personal information. Review [Google's terms](https://ai.google.dev/gemini-api/terms) and its pricing/data-use table before enabling it.

## Deployment and safeguards

See [DEPLOYMENT.md](DEPLOYMENT.md) for Vercel and hosted PostgreSQL/Neon setup. Production requires `DATABASE_URL`; an optional `DIRECT_DATABASE_URL` supports migrations. Set private `SESSION_SECRET` and `BANK_HASH_KEY` values. Embedded PostgreSQL is development-only.

- Live progress uses polling approximately every 400 ms. `STAGE_MIN_DISPLAY_MS=500` controls minimum stage display time.
- Submission workflows use Next.js `after` within the function lifetime: a configured 60-second function limit, 45-second cooperative work budget, and 10-second database statement timeout. This is not a durable job queue. Reviewer actions finish within their requests.
- Stalled runs older than 75 seconds are marked technically failed on an authorized status/detail read, without inventing a rejection.
- Limits: 1 MB per PDF, 3 MB combined per revision, 3.1 MB streamed request body, and 15 pages per PDF.
- Per-IP minute quotas are configurable with `RATE_LIMIT_WRITE`, `RATE_LIMIT_READ`, and `RATE_LIMIT_SESSION`; defaults are 20, 1,200, and 30. Trusted Scenario Runner fixture submissions and their owner-scoped polls are exempt; reset is not.
- Account numbers remain strings, are masked in results, and are matched using keyed hashes. Vendor case/run access and corrections remain session-scoped.
- Demo mode exposes synthetic dashboard summaries across sessions. Without demo mode, dashboard history is session-scoped; hosted non-demo use requires the configured access gate.

## Validation

Run checks sequentially; avoid running a dev server while building:

```bash
npm test
npm run build
npm run test:m1
npm run test:integration
npm run test:hosted
npm run test:m3
npm run test:m4
npm run test:m6
npm run test:limits
node --import tsx scripts/verify-m7.ts
node --import tsx scripts/verify-reset.ts
```

Focused Gemini and UI checks:

```bash
npx vitest run tests/gemini.test.ts tests/extract.test.ts tests/demo-pages.test.ts
```

Verification performed during development includes production-style runs with a real disposable PostgreSQL database, `DATABASE_URL` configured, and no OCR binaries. Checks cover S1–S8 outcomes, same-case corrections, reviewer authorization, stale/idempotent actions, reset behavior, and rate limits. The latest Gemini-focused run passed 32 targeted tests and the production build. Gemini API responses were mocked; this does not claim successful live-provider verification. The 390px layout has responsive styling, but browser verification at that viewport remains outstanding.

Use `npm run generate-test-data` to regenerate fictional PDFs/JSON fixtures, and `npm run test:local` for optional native OCR checks. Test commands retain their historical milestone names for reproducibility.

## Key files and limitations

| Location | Responsibility |
| --- | --- |
| `config/countries/india.ts` | Versioned India policy |
| `lib/rules.ts` | Deterministic checks and decision precedence |
| `lib/extract.ts`, `lib/gemini.ts`, `lib/local-reader.ts` | Evidence extraction, validation, cache, and fallback |
| `lib/workflow.ts`, `lib/resubmit.ts`, `lib/review.ts` | Execution, corrections, and review actions |
| `lib/db/`, `migrations/` | PostgreSQL persistence and seed data |
| `app/page.tsx`, `components/demo-pages.tsx` | Main interface, stepper, Scenario Runner, and policy view |
| `test_data/`, `tests/`, `scripts/verify-*.ts` | Fictional inputs and regression checks |

The local parser works best with English, printed, labelled documents. Confidence scores are extraction heuristics or model estimates, not calibrated proof of correctness. No external government-registry, tax-registration, or bank-ownership verification is performed. Sessions expire after 24 hours, and uploaded PDFs are stored in PostgreSQL for this small demo. Real-world use would require stronger authentication, privacy controls, appropriate document storage, and a durable execution system.
