# Kaushik Nursery

Node.js 24 / Fastify application with MySQL 8.4, Redis, a responsive nursery storefront, customer accounts, service bookings, partner workspace and administrator console. The visual direction references NurseryLive; the business flows follow the supplied Kaushik Nursery proposal.

## Run locally

```sh
npm ci
cp .env.example .env
# Replace DB_PASSWORD, MYSQL_ROOT_PASSWORD and SESSION_SECRET with independent random values.
# For local payment testing only, set PAYMENT_MODE=test.
docker compose up -d --wait
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://127.0.0.1:4173. Existing local setup uses MySQL on 3307 and Redis on 6381, bound to localhost. Catalog seeding inserts starter products and services; it creates no accounts, default passwords or approved partners. Production should use reviewed business catalog data.

Create your administrator with `npm run admin:create -- --email admin@your-domain --name "Nursery administrator"`. The CLI reads a password privately from the terminal (minimum 16 characters); never pass it as a command argument. Registration only creates customer accounts. Administrator access is enforced by the server. To create another operator account, use the same CLI with a different email.

## Implemented

- Password sign-in, optional real SMS OTP, password reset via SMTP, HttpOnly sessions, mobile bearer tokens, CSRF/origin checks and shared rate limits.
- Product categories, search/sorting, stock, saved addresses, wishlist and cart persisted in MySQL.
- Server-priced checkout, transactional inventory reservations, idempotency, reservation expiry, own-order tracking/cancellation and administrator fulfilment.
- Razorpay order creation, captured-payment verification, signed replay-safe webhooks and durable refund reconciliation. Product orders and service bookings have separate payment records.
- Service packages, reference uploads, future visit scheduling, approved partner matching by city/category/availability, configurable recipient limit (default six), rotation and atomic lead acceptance.
- Partner applications/documents, manual approval, assignments, job progress/completion uploads, customer reviews and administrative assignment overrides.
- Private S3-compatible uploads in production, ownership checks and signed download links. Development has a local storage adapter.
- In-app notifications, queued broadcasts, optional FCM push delivery, newsletter persistence, CSV reports and audit logs.
- Database migrations, separate worker, readiness/liveness, protected metrics, admin API documentation, Docker deployment and load-test tooling.

The browser uses `/api` on the same origin. Local storage holds only city and guest bag/wishlist preferences; account roles, orders, payments and bookings come from the server. Test payments are explicitly labelled and rejected in production.

## Verify

```sh
npm run check
npm run build
npm test
npm run test:load
```

Integration tests use the real, separate local `kaushik_test` database. `database/docker-init.sql` provisions it on first container initialization; existing volumes may need this database/grant added by a local database administrator. Tests refuse a remote database. The HTTP smoke test defaults to 200 reads at concurrency 20. Neither test certifies production capacity.

## Deployment and scale

The requirement is **100,000 simultaneous users**. The code supports multiple stateless API processes with shared MySQL/Redis/object storage and leased background jobs. Achieving that traffic level requires provisioned infrastructure, workload-specific testing, monitoring and failover drills. It is not a promise about one Hostinger hosting plan or VPS.

- [Hostinger deployment](docs/HOSTINGER.md)
- [Architecture and capacity acceptance](docs/ARCHITECTURE.md)
- [API and mobile integration](docs/API.md)
- [Operations and recovery](docs/OPERATIONS.md)
- [Requirements coverage and remaining launch inputs](docs/REQUIREMENTS.md)
- [Verification record](docs/VERIFICATION.md)
- [Customer, partner and administrator audit](docs/PORTAL-AUDIT.md)

The supplied domain is `kaushiknursery.in` (currently a Vercel frontend at `www`). The user will manage DNS separately. Production infrastructure and external provider credentials are still needed. No Hostinger site has been overwritten, no infrastructure purchased and no production payment/SMS/email sent. Android applications and Play Store publication are separate deliverables; these APIs support their future integration.

Image provenance is in [ASSETS.md](ASSETS.md).
