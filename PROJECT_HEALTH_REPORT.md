# Project Health Report

## Project Status

**Partially complete — not production ready.** The React/Vite client and Express/Mongoose API implement substantial billing, retail POS, tenant, SaaS, and agency domain logic. Core backend workflows were tested successfully, but the full browser E2E environment and several API-backed SaaS/agency screens are not complete.

## Architecture

- `frontend`: React 19 SPA using an in-app history router, bearer token API client, shared types, and tenant-aware navigation.
- `backend`: Express API with Mongoose models, Zod validation on selected write routes, JWT authentication, membership-based RBAC, tenant-scoped queries, billing calculators, jobs, and provider abstractions.
- `shared`: common TypeScript contracts and canonical module identifiers.
- MongoDB stores organization-scoped operational records; memberships define a user's role per organization.

## Features

| Feature | Status | Evidence | Problems Found | Fixed |
| --- | --- | --- | --- | --- |
| Authentication and tenant access | Fully implemented | API revocation test; SaaS flow test | Existing JWTs kept stale role/access until expiry | Membership and active-user checks now run for every protected request |
| Organization switching | Fully implemented | 19-assertion SaaS flow | Module identifiers differed by layer | Canonical module filtering and preset cleanup |
| Invoices and payments | Fully implemented | Calculator and logic-audit suites | Not re-run as a full browser flow | No regression observed in type checks |
| Retail POS and inventory | Fully implemented | POS integration (9 scenarios) and POS E2E-style backend test (2 scenarios) | None discovered in this pass | Preserved |
| Team management | Partially implemented | Controller review | User listing only used home organization; disabling was global | Membership-based listing and tenant-scoped access updates |
| SaaS and agency CRUD | Backend only | Routes/controllers present | SPA exposed dead navigation without pages | Unsupported links removed; backend remains available |
| Browser E2E | Partially implemented | Playwright spec exists | Requires running services and seeded demo account; not executed here | Documented prerequisite |

## Bugs Found and Fixed

| Bug | Severity | Root cause | Fix |
| --- | --- | --- | --- |
| Revoked membership retained API access | Critical | JWT role/access trusted without database revalidation | Protected middleware checks active user and active membership, and uses current membership role |
| Cross-organization team users were omitted | High | Team listing queried `User.organizationId`, not memberships | List now resolves organization memberships |
| Team access changes affected all organizations | High | User `isActive` was updated globally | Membership status is updated per organization |
| Last organization administrator could be removed | High | No active-admin guard | Prevent last active admin from demotion/disablement |
| Arbitrary module values could enter new organizations | Medium | Creation did not validate module keys | Central module allow-list and sanitization |
| CORS accepted every origin | Medium | `origin: true` with credentials | Explicit `CLIENT_URL` allow-list |
| Internal stack traces could reach development clients | Medium | Error handler included stacks | Client responses no longer include stack traces |
| Sidebar links silently returned to dashboard | Medium | Missing SPA routes for SaaS/agency pages | Removed unsupported links |

## Audit of 2026-10-04

| Bug | Severity | Root cause | Fix | Regression test |
| --- | --- | --- | --- | --- |
| Approval rules on invoice amount never fired | High | `createInvoice` evaluated business rules without `invoiceSubtotal`, so `invoiceSubtotal > N` compared against 0 (only the preview endpoint passed it) | Totals are calculated first and the subtotal is passed to the rule engine | `test:approvals` |
| Invoices held for approval could never be approved from the UI | High | Nothing created an `ApprovalQueue` entry; the queue page was always empty and the invoice page has no approve action | `createInvoice` queues held invoices; moving or cancelling a held invoice outside the queue closes its entry | `test:approvals` |
| Sales staff got 403 on returns, expenses and stock adjustments | Medium | Routes allowed a `cashier` role that does not exist (roles are admin/manager/accountant/sales/viewer) | Routes allow `sales` | `test:approvals` |
| Concurrent refunds of one payment all succeeded | Medium | Refundable balance was checked in memory, then saved | Atomic conditional update claims the refund; losers get 409 | `test:approvals` (3 parallel refunds, 1 applied) |
| Docker Compose MongoDB could not run sales, payments or returns | High (local setup) | Standalone `mongod`; transactions need a replica set | Compose runs and initiates a single-node replica set; unused Redis service removed | Verified locally: transaction fails on old compose, succeeds on new |
| CI ran 1 of 8 test suites | Low | Workflow only ran the calculator test | CI runs every backend suite | CI |
| Moderate advisories in morgan, multer, qs | Low | Outdated patch versions | `npm audit fix` (no major upgrades); `npm audit --omit=dev` reports 0 | Full suite re-run |

## Security

- Authentication: JWT bearer tokens with bcrypt password hashes.
- Authorization: current membership role is enforced on every protected request.
- Tenant isolation: controllers use organization IDs; POS integration and SaaS flow tests passed cross-tenant checks.
- Input validation: Zod protects auth, customer, invoice, and payment writes; some secondary routes still use controller-level checks.
- Secrets: production startup rejects absent/default JWT secrets. `.env.example` contains no usable secret.
- Remaining: rate limiting is in-memory and must be replaced by shared storage for multi-instance production deployments. Token storage is browser local storage, so an HTTP-only cookie/session design would be stronger against XSS.

## UI/UX

The existing design token system, responsive table containers, form controls, and feedback patterns are retained. Navigation now only exposes SPA routes that actually render. SaaS/agency CRUD exists in the API but requires dedicated SPA pages before it can be presented as a complete end-user feature.

## Testing

- Passed: TypeScript `--noEmit` checks for shared, backend, and frontend.
- Passed: invoice calculator unit suite.
- Passed: SaaS multi-tenant flow — 19 assertions.
- Passed: POS integration — 9 scenarios.
- Passed: POS E2E-style backend flow — 2 scenarios.
- Passed: API membership-revocation test.
- Frontend build passed; Vite warns of an approximately 810 kB JavaScript chunk.
- Full workspace build could not overwrite pre-existing locked files in `shared/dist` and `backend/dist` (Windows `EPERM`); this is an environment artifact issue, not a TypeScript type failure.
- Browser Playwright tests were not run because the required live frontend/API/seed setup was unavailable.

## Database and API

Mongoose schemas model organizations, memberships, users, invoices, payments, products, inventory movements, POS shifts, purchases, returns, subscriptions, projects, timesheets, and retainers. Membership has a unique `(userId, organizationId)` index and is now the source of truth for organization-specific access. API routes are versioned under `/api/v1`; errors use structured envelopes.

## Mock/Fallback Audit

- Development-only: seed accounts and MongoMemoryServer test databases.
- Intentional fallback: AI uses deterministic tenant-aware output when no LLM credentials are configured.
- External payment providers: production providers require credentials; test/sandbox flows must not be treated as live payments.

## Remaining Work

1. Add browser E2E coverage for the SaaS (plans/subscriptions) and agency (projects/timesheets/retainers) pages, which now exist in the SPA.
2. Configure and run browser E2E against a real development stack with stable seeded fixtures.
3. Replace local-storage bearer tokens and in-memory rate limiting for a hardened horizontally scaled deployment.
4. Resolve the workstation's locked generated `dist` files, then run the complete workspace build. Split the frontend bundle to remove the Vite size warning.
5. Add a supported ESLint flat configuration and dependencies (the broken backend `lint` script, which had no ESLint installed, was removed).
6. Re-run business rules when a draft invoice is edited, and apply `apply_discount` / `add_surcharge` rule effects to totals (currently reported only).
