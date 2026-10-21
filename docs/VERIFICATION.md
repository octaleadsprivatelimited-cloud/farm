# Verification record

Local verification performed on 2026-10-21 using Node 24.16.0, MySQL 8.4 and Redis 7.4 in Docker. This record describes executed checks, not a production capacity certification.

## Automated checks

- JavaScript syntax checks and static asset build pass.
- 44 integration tests pass against real local MySQL in the separate `kaushik_test` database, with isolated Redis namespaces.
- Tests cover real catalog/readiness/static serving; caller-selected role rejection; HttpOnly/CSRF/origin protection; customer/admin and cross-customer isolation; server prices; inventory races and idempotency; signed/replayed/amount-mismatched payment events; expiry and late-capture refunds; refund retry reconciliation; atomic partner acceptance; private uploads; settings/reports; two-instance session revocation and user disablement; OTP reuse/attempt limits; encrypted device tokens and push queue; broadcast replay; partner document onboarding/approval; service payment/progress/review; protected OpenAPI; password reset/change revocation; and production configuration/cookie/S3-adapter construction.
- `npm audit --omit=dev --audit-level=high`: no known vulnerabilities reported by the registry at verification time.
- Docker image builds and runs as its non-root application user with a read-only root filesystem and temporary writable `/tmp`. Readiness, homepage and catalog returned HTTP 200 against the real local database/Redis. Temporary verification container was stopped and removed.
- `deploy/Caddyfile.example` and `deploy/Caddyfile.production` validate using the Caddy 2 container. It is an example and has not served traffic or obtained a certificate for the nursery.
- Deployment source preparation creates an allowlisted directory excluding `.env`, uploads, databases, credentials and local test artifacts. The directory is intended for the native Hostinger tool's own automatic packing.

## Bounded HTTP smoke test

Latest run executed against the rebuilt Docker API at `http://127.0.0.1:4174`, using development configuration and local MySQL/Redis:

| Metric | Observed |
| --- | ---: |
| Catalog requests | 200 |
| Concurrent requests | 20 |
| Errors | 0 |
| Wall time | 1,525 ms |
| Throughput during this short sample | 131 requests/sec |
| p50 / p95 / p99 | 110 / 336 / 356 ms |

This brief, cached, read-only local sample is a sanity check. It does not estimate sustained cluster throughput, authenticated mixed traffic, provider latency, failover or 100,000 simultaneous customers. Detailed raw output is local and ignored at `load-tests/results/smoke.json`. The distributed k6 browsing/mixed profiles and the 100,000-row fixture script have **not** been run.

## Browser checks

The real storefront and Node API were exercised with synthetic local accounts:

- Customer sign-in, editable contact phone, default saved address, search, wishlist, cart, simulated checkout and true own-account totals.
- Administrator creation of a product with an existing photo and a service with three packages; package fields survive adding another package. User search returns the matching customer. Business details and background-job recovery views render.
- Partner application with a sample leaf image as a private document; pending resubmission retains the owned document. Administrator approval and eligible matching assignment succeed.
- Partner sequential progress through confirmed/scheduled/in progress/completed, including a sample completion photograph. The customer sees the attachment, makes a simulated service payment and saves a review.
- Reloads retain authenticated customer/admin sessions and persisted records. A first-load JavaScript initialization defect discovered during this check was fixed. Mobile booking controls were checked at 390×844; attachment/action wrapping was repaired. Final browser error/warning log was empty.
- Password-change controls were inspected in the browser; password changes/reset/session revocation were exercised through the automated backend tests.

The 14 follow-up regression scenarios additionally cover contact identity, default-address invariants, hidden catalog removal, paid totals, a partner's personal bookings, bounded user/partner search, image validation and package preservation, service image access, category visibility, job retry/audit, business cache refresh, private notification pagination, and concurrent wishlist limits/idempotency. Partner amendment/rejection/resubmission is covered by the expanded onboarding test.

Temporary QA accounts were signed out, disabled and stripped of password hashes; their sessions were revoked and their credential file removed. QA test payments were refunded, the nursery order cancelled and QA catalog entries hidden. Labelled completed-booking/review history remains in the development database. No default production administrator/password exists.

Screenshots remain local (excluded from Git) under `output/preview/`: `portal-customer.jpg`, `portal-customer-mobile.jpg`, `portal-admin.jpg` and `portal-partner.jpg`, showing tested states before cleanup. See `PORTAL-AUDIT.md` for the follow-up findings.

## External limits

No production Hostinger deployment, database provisioning, VPS purchase, DNS change, live payment, SMS, email or FCM delivery occurred. External providers need operator-owned credentials and sandbox/live acceptance. S3 adapter construction is tested; a real bucket upload/copy/download round trip remains to be verified against the selected provider. The nursery domain was subsequently supplied as `kaushiknursery.in`; its frontend currently runs on Vercel, while the connected Hostinger account has no VPS. The user will manage DNS separately. Approved production infrastructure and provider credentials remain pending. No 100,000-user concurrency result is claimed.

## Homepage and visual follow-up

Added administrator-managed hero banners backed by MySQL settings, with revision checks, audit records, desktop/mobile images, uploads, ordering, visibility, links and rotation controls. Three additional integration tests cover publishing/validation/authorization, concurrent-editor conflicts, and public image visibility only for active references. The full suite now has 44 passing tests.

Browser checks exercised real admin upload, mobile image selection, reordering without losing a selected file, save, storefront publication, next/dot controls, and category navigation through the mobile dropdown. Responsive checks at 320, 390, 768 and 1280 pixels verified header layout and page overflow. Phone hero text is visually removed. The main header stays sticky; the announcement bar hides on downward scroll and returns on upward scroll. Motion provides the dropdown spring/stagger animations; reduced-motion settings disable animation and automatic banner rotation. The palette uses deep leaf green with brighter lime highlights. Screenshots are excluded from Git in `output/preview/` (`mobile-leaf-hero.jpg`, `mobile-leaf-menu.jpg`, `desktop-leaf-hero.jpg`, `admin-banners.jpg`).
