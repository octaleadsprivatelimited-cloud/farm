# Requirements coverage and launch inputs

Source: the 30-page supplied `KAUSHIK NURSERY (1).pdf`, reviewed as product requirements. Text inside that document does not authorize account purchases, external communication or changes to unrelated hosting.

| Proposal area | Delivered in this repository |
| --- | --- |
| Services before commerce | Service-led homepage and separate nursery catalog |
| Customer account, orders and bookings | Real MySQL identity, addresses, cart/wishlist, separate order/booking histories |
| Single-vendor ecommerce | Administrator-managed nursery products, categories, stock ledger, server-priced checkout and fulfilment |
| Lead matching | City, category, approval and availability checks, default six recipients, rotation, atomic acceptance |
| Partner onboarding and work | Application/documents, manual approval/suspension, leads, assignments, progress and completion files |
| Admin control | Authenticated roles, users, partner decisions, assignment overrides, catalog/package/settings management, payment/refund tracking, CSV and audit |
| Uploads and reviews | Private ownership-checked uploads and completed-service reviews |
| Payments and notifications | Razorpay integration, signed capture/refund webhooks, reconciled worker, in-app notifications, optional FCM/Twilio/SMTP adapters |
| Public information | Responsive landing pages, service/product browsing and existing informational dialogs |
| Customer/partner Android apps | API support and responsive browser workflows only; native APK/AAB, device push integration and Play Store publication remain separate work |
| Hostinger and capacity | Deployable Node/Docker source and runbooks; external deployment and 100,000-user acceptance are pending |

The supplied domain is `kaushiknursery.in`; the user will manage DNS separately. Production compute, database, Redis and object storage still need approval and provisioning. Before public launch, supply approved infrastructure/budget, production MySQL/Redis/object storage, business catalog/prices/stock, support contacts, service coverage, approved professionals, final policies/taxes/shipping/refund rules and provider credentials. Review whether quoted prices include tax and whether service payment/commission/settlement rules require additional accounting flows. This implementation charges the nursery directly and does not implement split settlements to partners, courier-provider tracking, GST invoice generation, multilingual Android applications or automated identity-document verification.

Razorpay, Twilio, SMTP, S3 and FCM integrations are implemented but have not been exercised against live paid services. They remain disabled until configured; payment test mode is development-only. No production secrets belong in Git, browser code, screenshots or the deployment source package.
