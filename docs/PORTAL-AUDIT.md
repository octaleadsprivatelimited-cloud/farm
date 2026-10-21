# Portal audit — 2026-10-21

The requested customer, partner and administrator audit is implemented and checked locally. The source is prepared for the existing `codex/nurserylive-ui` branch; GitHub push confirmation belongs in the delivery message.

| Area | Resolved findings | Verification |
| --- | --- | --- |
| Customer portal | Separate personal histories for every role; database totals; captured-spend calculation; actionable pay/cancel/review cards; contact phone editing without claiming verified identity; default-address invariant | Browser checkout/address/profile/reload and backend isolation/regression tests |
| Cart and wishlist | Batched hydration; unavailable-item removal; disabled checkout with a clear explanation; paged wishlist; transactional 500-item limit and idempotent re-save | Browser purchase, hidden-item and concurrent-limit tests |
| Catalog administration | Existing image retained; real asset validation; optional catalog uploads; 1–10 packages with preserved IDs/prices/descriptions and selected upload across package edits; category visibility controls | Browser product/three-package creation; image/category/package tests |
| Partner portal | Private document onboarding; pending/rejected amendment and resubmission; match by city/category/approval/availability; exclude self-owned requests; eligible-partner search with cursors; current/next job status choices | Browser application/resubmission/approval/assignment/completion-photo journey; acceptance-race and onboarding tests |
| Administrator portal | Search users by exact email/phone or name prefix; private account data boundaries; valid order transitions; hide closed-request assignment; refund confirmation; failed-job retry with audit; editable public business details | Browser views/search/assignment; authorization, job-retry and business-cache tests |
| Reliability and mobile | First-load authenticated initialization fixed; atomic private-state refresh; bounded network/upload timeouts; explicit simulated-payment text; service amount/payment status; mobile booking action/attachment wrapping | Browser reload, 390×844 check, completed-service payment/review, empty console error log |
| Delivery | Node/MySQL/Redis app, migrations, CI, Docker, protected metrics, deployment/runbooks and distributed load-test profiles | 41 passing integration tests, syntax/build/audit, non-root read-only Docker runtime and bounded HTTP smoke |

Real provider credentials, approved infrastructure, bucket round-trip verification, business contacts/catalog/policy review, native Android apps and the distributed 100,000-user acceptance run remain external launch work. The public domain currently serves the earlier Vercel frontend. This branch targets a Node runtime with `/api` on the same origin; do not promote a static-only Vercel preview as the full application.

The user manages DNS separately. Infrastructure budget discussion does not authorize a purchase. No production deployment or purchase was performed during this audit.
