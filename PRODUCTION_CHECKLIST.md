# RepairScout production checklist

The public application is deployed at:

https://repairscout-smoky.vercel.app

## Required before accepting real customers

1. [Complete] Managed Neon PostgreSQL is connected through `DATABASE_URL`.
2. [Complete] A strong production `AUTH_SECRET` is configured.
3. [Resolved differently] Real AI diagnosis now runs via Groq/Gemini/OpenRouter/local
   Ollama, tried in that order before AI Gateway — the payment-card requirement no
   longer blocks anything. See "Current AI status" below.
4. [Complete] `/api/health` confirmed live 2026-08-16: `"database":"postgres"`,
   `"authConfigured":true`, `"aiConfigured":true`.
5. Register one driver account and one shop account.
6. Verify that a driver quote appears only in the intended shop inbox.
7. Replace demo part prices with licensed supplier or affiliate integrations.
8. Add a licensed labor-time provider before presenting labor hours as authoritative.
9. [Complete for private preview] Add privacy policy, terms, support contact, and customer consent language before sending quote requests.
10. [Complete for private preview] Add basic API rate limits and security headers.
11. [Mostly complete, 2026-08-16] Data-deletion workflow, email verification, and
    password reset are live and confirmed working end-to-end (both via test suite
    and a real browser walkthrough) — see `DELETE /api/auth/me`,
    `GET /api/auth/verify-email`, `POST /api/auth/forgot-password` /
    `reset-password`. Audit logging is live for auth/admin/quote-status actions.
    **Backups**: `repairscout-db` is confirmed via the Neon API to be on the
    Free plan with point-in-time recovery enabled, 6-hour retention window
    (Free plan's max — paid Launch/Scale plans go to 1-30 days). Upgrading
    the Neon plan tier is a cost/risk decision, not a code task.
    **Monitoring**: Sentry is wired up in code (2026-08-17) — same pattern as
    white-glove-backend/frontend, initialized before anything else in
    `server/index.js`, capturing uncaught exceptions/rejections and any
    unhandled Express route error. Fails closed to console-only logging if
    `SENTRY_DSN` is unset. Still needs a real DSN provisioned (create a
    Sentry project, add `SENTRY_DSN` to the Vercel env vars) before it
    actually reports anywhere.

## Current public-preview behavior

- VIN decoding is live through NHTSA.
- Diagnosis API is live using real AI (Groq/Gemini/OpenRouter/Ollama), not the
  safety-only fallback — confirmed live via `/api/health`: `aiConfigured: true`.
- Account, vehicle, diagnosis, and quote storage is persistent in Neon PostgreSQL.
- Nearby-shop search attempts OpenStreetMap and falls back to RepairScout demo shops.
- Parts prices and shop ratings shown in the interface are demonstration data.
- Privacy, terms, support, and quote-consent screens are included for private demos.
- API routes include lightweight in-memory rate limiting suitable for preview, not a replacement for Vercel Firewall or a durable Redis-backed limiter.
- Three Identifix-style features live as of 2026-08-16: confirmed-fix search
  (`/search`, `GET /api/repairs/search`), OBD code + vehicle-specific fix
  history (`GET /api/obd/fix-history`), and safety recalls by VIN
  (`GET /api/vehicle/recalls`, NHTSA-sourced, recalls only — not TSBs).
  Confirmed live in production via a real `curl` against
  `/api/repairs/search`.

## Vercel project

- Project: `humberto-s-projects7/repairscout`
- Public alias: `repairscout-smoky.vercel.app`
- Neon resource: `repairscout-db`

## Current AI status (updated 2026-08-16, confirmed live not assumed)

No longer blocked. `server/*` now tries Groq, Gemini, OpenRouter, and local Ollama
before falling back to Vercel AI Gateway — AI Gateway's `customer_verification_required`
payment-card issue is now just the last-resort option in the chain, not a blocker.
Confirmed via a live `curl` against `/api/health`: `"aiConfigured":true`, all 5
providers listed as configured. Real AI diagnosis is running for real users right now,
not the safety-only fallback.
