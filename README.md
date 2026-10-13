# Kaushik Nursery

A polished, responsive frontend prototype based on the Kaushik Nursery **E-Commerce & Multi-Service Marketplace Android Application** scope proposal.

The design combines warm ivory, forest green, generous typography and botanical photography. A growing stem and sequentially unfolding leaves welcome visitors. The introduction can be skipped or replayed from the Explore menu and footer, and respects reduced-motion preferences.

## Run locally

Requires Node.js 20 or newer. There are no third-party runtime dependencies.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:4173. Use `PORT=4174 npm run dev` to choose another port.

```sh
npm run check
npm run build
```

The production build is generated in `dist/`. `vercel.json` configures Vercel to run the build and publish that folder.

## Experiences

- **Customer — `#home`, `#services`, `#shop`, `#orders`:** service-first home; separate product catalog with search, category filtering, price sorting and saved plants; product details; stock-aware bag and quantities; delivery charge calculation; simulated checkout; three-step service requests with packages, property details, area, preferred date/time, address and reference-file names; separate order and service histories; demo mobile OTP login.
- **Partner — `#partner`:** approved partner dashboard; relevant leads; acceptance and decline; assigned jobs and customer requirements; status updates, completion remarks and image-file names; profile and availability; registration with document-file names and an approval gate.
- **Admin — `#admin`:** dashboard; users; partner approval, rejection and suspension; manual lead assignment, reassignment and cancellation; editable catalog, stock, service categories and packages; product order status; simulated product and service payment/refund states; locally saved notifications; CSV exports; configurable maximum recipients and lead rotation.

## Lead rules

A new lead is sent to approved, available partners in the selected city whose service category matches. Up to six recipients are selected by default; the admin can change that limit. With rotation enabled, partners with fewer previous allocations receive priority. Acceptance assigns the lead to one partner and removes it from the other partners' open-lead views. Admin can override or remove that assignment.

## Preview data and production boundaries

The app uses browser local storage (`kaushik-preview-v1`), with sample catalog prices, services and partner profiles. The introduction's first-visit flag uses session storage. Demo changes are scoped to the browser and are not stored on Vercel. Use sample details when testing.

- OTP is simulated with code **123456**; there is no real authentication.
- Purchases, payments, refunds, service bookings and notifications are simulations.
- Files are not uploaded; only their names are recorded.
- Admin and partner workspaces are openly accessible prototype routes; production needs authentication and role enforcement.
- No Android binaries, Play Store listings, backend, SMS provider, payment gateway, document verification or delivery integration are implemented.
- The responsive web screens preview the proposed Android experiences. The final public company website should remain informational according to the proposal.
- Final catalog, prices, contact details, policies, service charges, assignment rules and business terms need confirmation before production use.

## Source

`public/` contains the editable HTML, CSS and JavaScript. `scripts/build.mjs` validates JavaScript and copies the frontend to `dist/`. `scripts/serve.mjs` is the local static server. No compilation framework is required.

The custom generated hero asset, prompt and other asset sources are documented in [ASSETS.md](ASSETS.md).

## Validation

Verified in the browser at desktop and mobile widths: no horizontal page overflow; image loading; separate customer histories; stock-aware cart and simulated checkout; service request matching; partner acceptance and completion; admin approval; lead settings; animation replay. Build and JavaScript syntax checks pass. Real authentication, APIs, payments and Android deployment require separate implementation.
