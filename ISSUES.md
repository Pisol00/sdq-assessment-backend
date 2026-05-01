# Backend Issues & TODO

## Critical

- [ ] **Email service not implemented** — `src/email/email.service.ts` `deliver()` method only logs to console. `forgot-password` and `verify-email` flows produce no actual emails. Need to integrate SMTP/SES/Resend.
- [ ] **Hardcoded JWT fallback secret** — `jwt.strategy.ts` and `auth.module.ts` both have `|| 'dev-secret'`. If `JWT_SECRET` env var is missing in production, a known secret is used. Remove the fallback and let it throw.

## Important (fix before production deploy)

- [ ] **No rate limiting** — No throttler module on login/signup endpoints. Vulnerable to brute force attacks.
- [ ] **No Helmet** — `main.ts` does not configure `@nestjs/helmet`. Missing security headers (CSP, X-Frame-Options, HSTS, etc.).
- [ ] **CORS wildcard + credentials** — If `CORS_ORIGIN` env var is undefined, CORS falls back to `origin: '*'` with `credentials: true`, which is insecure. Should throw or default to a safe origin.
- [ ] **File upload no size limit** — `POST /students/import` uses `FileInterceptor` with no `limits.fileSize`. Large file uploads are not rejected.

## Payment (Phase 2)

- [ ] **Stripe keys not configured** — `.env` has empty `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and price IDs. Any real payment call will throw `InternalServerErrorException`. Frontend is currently mocked so this is acceptable for now.
- [ ] **Remove unused OMISE env vars** — `OMISE_PUBLIC_KEY` and `OMISE_SECRET_KEY` are in `.env` but no Omise integration exists. Clean up to avoid confusion.

## Database

- [ ] **`DB_SYNC=true` in `.env`** — Auto-syncs Prisma schema on every startup. Must be set to `false` before production to avoid unintended migrations.
- [ ] **`Assessment.date` not indexed** — Used in report/aggregate queries but has no `@Index()`. Add index for performance at scale.

## Medium

- [ ] **Weak password validation** — Signup only requires 8 characters minimum. Consider adding complexity rules (uppercase, number, special char) via a custom validator.
- [ ] **Enum string comparison inconsistency** — `students.service.ts` uses `plan === 'FREE'` (string literal) while other files use `SubscriptionPlan.FREE`. Standardize to the enum constant.
- [ ] **No request audit logging** — Sensitive operations (payment, password reset, admin actions) have no audit trail middleware.
- [ ] **No account deletion / data export** — No GDPR-style endpoints for users to export or delete their data.
