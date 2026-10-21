# API and mobile integration

The API base is `/api` on the storefront's HTTPS origin. Administrator-only Swagger UI is `/api/docs/`; its JSON specification is `/api/docs/json`. JSON bodies reject unknown fields. Errors are `{error:{code,message,requestId}}`; do not infer success from a 200 transport response without checking resource state.

## Authentication

`POST /auth/register` accepts `{name,email,password,city?}`. Passwords have a 12-character minimum. No caller-selected role exists. `POST /auth/login` accepts `{email,password,client?}`. Web responses set an opaque HttpOnly `kn_session` cookie and return `{user,csrfToken}`. Send `X-CSRF-Token` on subsequent writes, with same-origin cookies. `GET /auth/session` recovers session/CSRF after reload; `POST /auth/logout` and `/auth/logout-all` revoke sessions.

Android clients use `client:"mobile"` on login/register/OTP verification and store returned `accessToken` in platform secure storage. Send `Authorization: Bearer TOKEN` on each request; bearer requests do not require browser CSRF. Never put tokens in URLs/logs. Tokens expire after `SESSION_DAYS` (default seven); there is no refresh token. Reauthenticate when expired/revoked.

Optional `POST /auth/otp/request {phone}` returns a challenge ID; `/auth/otp/verify {challengeId,code,name?,client?}` consumes the code once. SMS must be configured. A contact phone entered at registration is not a verified login identity and cannot claim another phone account. Email and phone identities are not automatically merged. `/auth/forgot-password {email}` sends a single-use reset link through configured SMTP; `/auth/reset-password {token,password}` revokes sessions. `/auth/change-password` requires the current password. Password-reset and OTP codes never appear in API responses.

## Route families

| Area | Endpoints and behavior |
| --- | --- |
| Initial state | `GET /bootstrap` returns public starter catalog/services/categories and current session; authenticated account data is separate |
| Catalog | `GET /products?q=&category=&sort=&page=&limit=`, `/products/:id`, `/categories`, `/services`, `/service-categories`, `/config` |
| Account | `GET/PATCH /account`; `GET/POST /addresses`, `PUT/DELETE /addresses/:id`, `PATCH /addresses/:id/default` |
| Cart/wishlist | `PUT /cart/:productId {quantity}` (zero removes); `PUT /wishlist/:productId {saved}`; `GET /wishlist/products` |
| Product orders | `POST /orders {addressId,items:[{id,qty}]}`; `GET /orders`, `/orders/:id`; `POST /orders/:id/cancel` |
| Bookings | `POST /bookings {serviceId,packageId,name,phone,city,address,property,area,date,time,description,uploadIds?}`; list/detail/cancel; `PUT /bookings/:id/review {rating,text}` only on owned completed services |
| Partner | `POST /partners/apply` (contact phone, approved-category choices and at least one completed owned document); `GET/PATCH /partner/profile`; `/partner/leads`, `/partner/jobs`; `POST /partner/leads/:id/accept` or `/decline`; `PATCH /partner/jobs/:id` for one-step progress and completion uploads |
| Payment | `POST /payments {orderId}` or `{bookingId}`; `/payments/verify`; signed `POST /webhooks/razorpay`. Never submit a client amount. Services become payable after assignment |
| Files | `POST /uploads/presign`, upload bytes to returned URL with returned headers, `POST /uploads/:id/complete`, authenticated `GET /uploads/:id/content` |
| Notifications | `GET /notifications`, `PATCH /notifications/:seq/read`; `POST /devices {token,platform}` and `DELETE /devices/:id` for optional FCM |
| Administration | `/admin/overview`, `/users`, `/partners`, `/products`, `/categories`, `/services`, `/service-categories`, `/bookings`, `/orders`, `/payments`, `/settings`, `/notifications`, `/jobs`, `/audit`, `/reports/:type`; mutations require administrator role |
| Newsletter | `POST /newsletter {email}` persists the subscription; bulk campaign email sending is separate |

Product/booking creation **requires `Idempotency-Key`** (8–128 characters). Persist one UUID per intended request and reuse on network retries; different content with the same key returns 409. MySQL is authoritative for price, stock, package availability and ownership. Order stock is reserved for 15 minutes. HTTP 201 can return an existing idempotent resource; use its ID/state.

Most private lists use `?limit=25&cursor=...`, returning `items,nextCursor`; pass the cursor unchanged. Limits cap at 100. Public catalog has bounded page pagination and `hasMore`; partner/admin product directories use their documented UUID cursors. Notification payload/sequence values and other BIGINT identifiers should be treated as strings, never arithmetic JavaScript numbers.

Uploads allow up to eight attachments, 8 MiB each, with JPEG/PNG/WebP/PDF content validation. Access depends on owner, administrator, assigned booking or active public catalog reference. Server completion verifies metadata/signature bytes, not malware safety; integrate a scanner/quarantine policy if business/security requirements demand it. FCM tokens are encrypted and automatically removed with revoked/expired sessions. The future Android/web-push clients must obtain their own FCM registration token and register it after sign-in; this repo does not contain an Android app or web push service worker.

See the generated schema for exact route bodies and allowed status values. Do not hardcode administrator access, partner approval, OTP values, gateway secrets or price calculations in a client.
