# Operations and recovery

## Start, observe and stop

`npm start` runs the API. `npm run worker` runs durable jobs without a public listener. Production should use separate supervised processes/containers and `RUN_WORKER=false` in API replicas. Development can run the worker in-process. Migrate once per release; do not enable migration/seeding on every production API startup.

`GET /health/live` checks the process; `/health/ready` checks MySQL and Redis. Restrict infrastructure probes at the network/edge as appropriate. `GET /metrics` needs `Authorization: Bearer METRICS_TOKEN`; it exposes HTTP duration/count histograms by route template and default process metrics, not user IDs. Collect database connection/lock/IO/replication metrics and Redis memory/latency separately. Alert on error rate, latency, pool saturation, non-ready replicas, oldest job, failed/reconciliation refunds and push failures. Process logs omit cookies and authorization headers; keep access logs protected and apply retention.

SIGTERM stops workers and drains Fastify before database/Redis shutdown. Configure a 30-second or longer supervisor drain and retain a healthy API during rolling replacement. Never retry unkeyed writes at a load balancer. The Caddy example retries only reads.

## Backups and restore drills

Use automated, encrypted off-server MySQL full backups plus binlog shipping/point-in-time recovery on the dedicated database service. Agree RPO/RTO with the business; an initial objective to validate is 15-minute RPO and 1-hour RTO, not an implemented guarantee. Enable bucket versioning/lifecycle and a documented Redis recovery strategy. Hostinger VPS snapshots alone do not replace application-consistent off-server database backups.

For an operator-run logical backup, use MySQL 8.4 `mysqldump --defaults-extra-file=/secure/backup.cnf --single-transaction --routines --triggers --events --set-gtid-purged=OFF DATABASE`, streaming into an encrypted backup destination. The mode-600 client config holds credentials and TLS settings; never put a password in shell history or project source. Encrypt and checksum the artifact, retain it according to policy and test restoration into a **fresh isolated database** with compatible MySQL, never the live primary. Import with the MySQL client, run checksum/migration and row/invariant checks, then run synthetic checkout/booking/payment sandbox tests. Record elapsed recovery time and operator actions. A restore and promotion require explicit target verification and approval.

## Failed jobs and payment reconciliation

`GET /api/admin/jobs` and `/api/admin/payments` expose job/payment status. Database operators can inspect the read-only reconciliation query below. Do not log raw provider secrets or tokens.

```sql
SELECT j.id,j.type,j.status,j.attempts,j.last_error,r.status AS refund_status,
       r.provider_refund_id,r.payment_id,r.amount_paise
FROM outbox_jobs j LEFT JOIN refunds r ON r.id=j.id
WHERE j.status='failed' OR r.status IN ('sending','reconcile');
```

Refund workers submit a transfer once, record the provider refund reference, and fetch it on retries. If submission times out before a reference is known, they search the payment's refunds for `notes.localRefundId`. They do not blindly submit again. A provider result that remains uncertain eventually becomes a failed job for operator reconciliation. Validate against the gateway dashboard/API and compare amount/payment ID before any manual correction. A known failed refund also requires business/operator review; there is no automatic second money transfer.

After fixing the provider/configuration issue, an authorized database operator can reset a **specific verified** failed job to pending (clear lease, set `available_at=UTC_TIMESTAMP(3)`) and observe it. Never change refunds from sending/reconcile to pending merely to force another transfer. For payment rows left in `creating` after a crash, reconcile the provider receipt/localPaymentId before touching them. Unpaid product reservations expire and can be replaced with a new customer-approved checkout; do not invent a paid state.

Push uses at-least-once delivery with eight retries; invalid/unregistered devices are removed. Delivery retries can show the same message twice, so mobile clients deduplicate notification IDs. In-app messages remain authoritative when FCM is disabled. FCM/Twilio/SMTP provider quotas and outages need separate alerts.

## Security and data maintenance

Use least-privilege runtime database access; run DDL migrations with an operator role. Use TLS for external MySQL/Redis and private object storage; never expose MySQL or Redis publicly. Keep production secrets in a secret manager/server environment. S3 policy should allow only the needed bucket/prefix operations, including server-side copy for upload finalization. Pending uploads are copied to a fresh private key, validated there and then published in metadata, so a still-valid upload URL cannot change a completed file. Apply lifecycle cleanup to abandoned objects. Rotation of `SESSION_SECRET` invalidates opaque session lookups and encrypted device tokens: first revoke sessions/devices, then coordinate the same new secret across all replicas. Provider-key rotation does not require editing browser files.

The worker deletes expired sessions, old OTP challenges, password resets and fallback rate counters in bounded batches. It does not automatically purge order/payment/audit history. Define business/legal retention, account-erasure/anonymization, orphan-upload cleanup and attachment malware scanning before production. Changing user status revokes sessions; administrators are managed through the protected operator CLI, not public role changes. Review partner documents manually before approval.

## Rollback

Record the previous image digest and database backup/migration version before a release. Roll back application images only when the schema remains compatible. Migrations are checksum-checked and additive; never edit an already-applied migration or assume a DDL rollback is transactional. If a migration partly fails, inspect `schema_migrations` and the actual schema, then apply a reviewed repair migration. Database restore/promotion is a deliberate recovery operation and must be tested, targeted and approved.
