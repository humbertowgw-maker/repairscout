# RepairScout production checklist

The public application is deployed at:

https://repairscout-smoky.vercel.app

## Required before accepting real customers

1. [Complete] Managed Neon PostgreSQL is connected through `DATABASE_URL`.
2. [Complete] A strong production `AUTH_SECRET` is configured.
3. [Action required] Add a payment card to Vercel AI Gateway, or set `OPENAI_API_KEY`.
4. Redeploy and confirm `/api/health` reports:
   - `"database": "postgres"`
   - `"authConfigured": true`
   - `"aiConfigured": true`
5. Register one driver account and one shop account.
6. Verify that a driver quote appears only in the intended shop inbox.
7. Replace demo part prices with licensed supplier or affiliate integrations.
8. Add a licensed labor-time provider before presenting labor hours as authoritative.
9. [Complete for private preview] Add privacy policy, terms, support contact, and customer consent language before sending quote requests.
10. [Complete for private preview] Add basic API rate limits and security headers.
11. Add production-grade data-deletion workflow, email verification, password reset, monitoring, backups, and audit logs.

## Current public-preview behavior

- VIN decoding is live through NHTSA.
- Diagnosis API is live but uses the built-in fallback until OpenAI is configured.
- Account, vehicle, diagnosis, and quote storage is persistent in Neon PostgreSQL.
- Nearby-shop search attempts OpenStreetMap and falls back to RepairScout demo shops.
- Parts prices and shop ratings shown in the interface are demonstration data.
- Privacy, terms, support, and quote-consent screens are included for private demos.
- API routes include lightweight in-memory rate limiting suitable for preview, not a replacement for Vercel Firewall or a durable Redis-backed limiter.

## Vercel project

- Project: `humberto-s-projects7/repairscout`
- Public alias: `repairscout-smoky.vercel.app`
- Neon resource: `repairscout-db`

## Current AI blocker

AI Gateway is connected through Vercel OIDC, but model requests return
`customer_verification_required` until the Vercel team has a valid payment card.
The application continues using its safety-focused fallback diagnosis engine.
