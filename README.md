# RepairScout

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

## Product rule

RepairScout must distinguish among:

1. **Preliminary AI assessment** — possible causes based on user-provided information.
2. **Shop diagnosis** — findings supported by inspection and test evidence.
3. **Verified repair outcome** — the completed repair and whether it resolved the concern.

Licensed repair procedures, diagrams, and labor information from products such as ALLDATA or Mitchell 1 cannot be scraped or republished. Production use requires a license, approved integration, or another authorized data provider.
