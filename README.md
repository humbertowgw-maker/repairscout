# RepairScout

> **Project status:** First public version. The core workflow is implemented, but the product remains an early-stage preview with additional validation and production work still ahead.

RepairScout is a two-sided automotive repair platform:

- Drivers describe a vehicle problem, receive a preliminary AI assessment, compare parts and labor costs, and request verified quotes.
- Repair shops review customer concerns, verify diagnoses with evidence, create estimates, communicate with customers, and manage repair work.

The current version includes a working web API, live NHTSA VIN decoding, persistent quote requests, and structured AI diagnosis support. It intentionally labels AI findings as preliminary until a repair shop performs physical tests.

## Run locally

```bash
npm install
npm run dev
```

This starts:

- Web app: `http://localhost:4311`
- API: `http://localhost:4312`

Copy `.env.example` to `.env` to configure the AI:

```bash
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-5.5
```

Do not commit `.env`.

Create a production build with:

```bash
npm run build
```

## MVP capabilities

### Driver portal

- Vehicle profile and symptom intake
- Live VIN decoding through NHTSA vPIC
- ZIP code and radius selection
- API-generated possible causes and verification steps
- Safety and urgency guidance
- Parts and labor estimate range
- Local and online parts comparison
- Nearby verified-shop comparison
- Quote request confirmation
- Saved quote requests that appear in the shop portal
- Privacy, terms, support, and quote-consent screens for private demos

### Repair-shop portal

- Incoming quote-request dashboard
- Persistent customer quote inbox
- Appointment and work-order overview
- AI diagnostic workbench entry
- Customer concern review
- Preliminary quote ranges
- Evidence-first verification workflow
- Quote conversion metrics
- Rate-limited API routes for auth, diagnosis, quote, and general API traffic

## Data and integration roadmap

1. Email verification, password reset, account deletion, and richer role permissions
2. Shop discovery with geocoding, maps, distance calculation, and claimed-shop profiles
3. Licensed labor-time and repair-procedure integration
4. Parts catalog, fitment, pricing, store availability, and ordering integrations
5. Photos, videos, OBD-II codes, digital inspections, and technician evidence
6. Messaging, scheduling, electronic authorization, and payments
7. Verified repair outcomes, warranties, reviews, and vehicle service history
8. Monitoring, audit logs, backups, and admin moderation

## Production configuration

RepairScout can run locally without external services. For a durable public deployment, configure:

- `DATABASE_URL`: PostgreSQL connection string. Tables are created automatically.
- `AUTH_SECRET`: a long random value used to sign account sessions.
- `OPENAI_API_KEY`: enables structured AI assessments.
- `OPENAI_MODEL`: defaults to `gpt-5.5`.

Without `DATABASE_URL`, local development uses `server/data/repairscout.json`. A Vercel preview without a database uses temporary storage, so accounts and quotes may disappear between function instances. Connect PostgreSQL before treating the deployment as production.

## Deployment

The repository includes `vercel.json` and `api/index.js`, allowing the Vite frontend and Express API to deploy together as one Vercel project.

```bash
vercel
```

After validating the preview:

```bash
vercel --prod
```

### Protected local-first diagnosis queue

When `LOCAL_WORKER_TOKEN` is configured in production, free and paid customer
diagnoses are stored in PostgreSQL and pulled by a private local worker. Vercel
never connects directly to Ollama. The worker processes one job at a time by
default, waits while BrainOS health is unavailable, retries abandoned leases,
and fails a job after three attempts.

Configure the same random token as a sensitive production environment variable
and on the worker host, then run:

```bash
./scripts/install-local-diagnosis-worker.sh
```

The installer stores the token in an owner-only Application Support file and
installs a quiet LaunchAgent. `LOCAL_AI_MAX_CONCURRENT=1` is the safe launch default; increase it
only after observing memory pressure and queue latency.

## Engineering notes

Notes on how this was actually built, aimed at anyone reading the commit history rather than the pitch.

**Multi-provider AI diagnosis with one contract.** `server/diagnosis.js` tries providers in a configurable order (`groq,gemini,openrouter,ai-gateway,openai` by default) and coerces every response through the same Zod schema (`DiagnosisSchema`), so the frontend never has to know which provider actually answered. If no provider is configured, a rule-based fallback keeps the diagnosis flow working with zero AI keys — this isn't a stub, it's the documented dev-mode path (see `PRODUCTION_CHECKLIST.md`).

**Voice AI doing real phone verification.** `server/bland.js` uses Bland.ai to place actual outbound calls to local parts stores through a scripted bilingual persona ("Beto"), asking for stock, quantity, price, and same-day pickup, then parses the structured result out of a webhook. `POST /api/parts/verify` kicks off a batch of calls in the background and the frontend polls a batch-status endpoint every few seconds. Without `BLAND_API_KEY`, calls are simulated with randomized delays so the full UI flow (pending → on the line → confirmed) still works in local dev.

**Storage has an honest fallback, not a hidden one.** Postgres via `DATABASE_URL` is primary; without it, both local dev and a bare Vercel preview fall back to a JSON store (`server/data/repairscout.json` locally, ephemeral in a serverless preview). That distinction — and the fact that a database-less preview will lose data between function instances — is called out directly in `PRODUCTION_CHECKLIST.md` rather than glossed over.

**A caught production bug, visible in the history.** On 2026-07-29, a change meant only to add a portfolio-metrics route (`d323967`) shipped with roughly 350 lines silently dropped from `server/app.js` and mangled UTF-8 in the Spanish-language error strings (`contraseña` → `contraseÃ±a`). It was caught and reverted within about five minutes (`3f17050`, `4952dbe`, `51e19b7`), and the metrics endpoint was then rebuilt as its own isolated serverless function (`api/portfolio-metrics.js`, `58eb944`) instead of touching the shared route file again.

**A real false-positive bug, not a hypothetical one.** Until `cf7fa36` (2026-08-04), the OTP endpoint returned `sent: true` whenever Twilio wasn't configured — it logged the code to the console and told the client it had texted someone. Fixed to return a distinct `SMS_NOT_CONFIGURED` (503) instead of a false success, so the frontend can tell "we didn't send it" apart from "the carrier rejected it."

**A CodeQL-driven hardening pass.** `11b4d5c`, `05e02c4`, and `c0931e7` add `SECURITY.md`, `.github/dependabot.yml`, a CI workflow (`security.yml`) that runs `npm audit --audit-level=high`, a full build, and `node --check` on every server/API file, and explicit `express-rate-limit` windows on auth and OTP routes in response to actual CodeQL findings, not preemptively.

**What's not here yet:** there is no automated test suite — CI enforces build success, a dependency audit, and syntax checks, not behavior. The app is deployed at `https://repairscout-smoky.vercel.app` on Vercel with Neon Postgres connected, but per `PRODUCTION_CHECKLIST.md` the AI Gateway path currently returns `customer_verification_required` until a payment card is attached to the Vercel team, so production traffic is served by the rule-based fallback diagnosis engine until that's resolved.

## Product rule

RepairScout must distinguish among:

1. **Preliminary AI assessment** — possible causes based on user-provided information.
2. **Shop diagnosis** — findings supported by inspection and test evidence.
3. **Verified repair outcome** — the completed repair and whether it resolved the concern.

Licensed repair procedures, diagrams, and labor information from products such as ALLDATA or Mitchell 1 cannot be scraped or republished. Production use requires a license, approved integration, or another authorized data provider.
