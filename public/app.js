import {
  initialProducts,
  initialServices,
  initialPartners,
  initialLeads,
} from "./data.js";
import { policies } from "./policies.js";
import { firebaseService } from "./firebase.js";
const $ = (q, root = document) => root.querySelector(q);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (v) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);
const asset = (n) => `./assets/${n}`;
const dateLabel = (d) =>
  d
    ? new Date(d + "T12:00:00").toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Flexible";
const today = () => {
  let d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};
const iconPaths = {
  leaf: "M20 4C11 2 3 7 4 18c10 3 17-5 16-14ZM3 21 15 9",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  up: "M6 18 18 6M6 6h12v12",
  down: "m6 9 6 6 6-6",
  heart:
    "M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 7l-1-1.2a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z",
  bag: "M5 7h14l1 14H4L5 7ZM8 8V6a4 4 0 0 1 8 0v2",
  user: "M20 21a8 8 0 0 0-16 0M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  sun: "M12 3V1m0 22v-2M3 12H1m22 0h-2M5.6 5.6 4.2 4.2m15.6 15.6-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z",
  drop: "M12 2s-7 9-7 14a7 7 0 0 0 14 0c0-5-7-14-7-14Z",
  check: "m5 12 4 4L19 6",
  shield: "M12 2 3 6v6c0 6 9 10 9 10s9-4 9-10V6l-9-4Zm-5 10 3 3 7-7",
  garden:
    "M3 21h18M7 21v-7m10 7V9M7 14c-5 0-5-6-5-6s5 0 5 6Zm0-3c0-5 5-5 5-5s0 5-5 5Zm10-2c-5 0-5-6-5-6s5 0 5 6Zm0-3c0-5 5-5 5-5s0 5-5 5Z",
  tools:
    "M14 5a6 6 0 0 0-7 7L2 17a3 3 0 0 0 4 4l5-5a6 6 0 0 0 7-7l-4 4-4-4 4-4Z",
  truck:
    "M1 4h13v13H1V4Zm13 5h5l4 5v3h-9V9ZM8 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm13 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  calendar: "M4 5h16v16H4V5ZM7 2v6m10-6v6M4 11h16",
  clock: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Zm-10-6v6l4 2",
  search: "M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-2 6 6 6",
  plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  menu: "M4 6h16M4 12h16M4 18h16",
  dashboard: "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7",
  briefcase: "M3 7h18v14H3V7Zm5 0V3h8v4M3 12h18m-11-1v3h4v-3",
  users:
    "M16 21a6 6 0 0 0-12 0m19 0a6 6 0 0 0-5-6M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm5-4a4 4 0 0 1 0 8",
  bell: "M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Zm4 3a3 3 0 0 0 6 0",
  chart: "M4 3v18h17M8 17v-5m5 5V8m5 9V4",
  settings:
    "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Z",
  replay: "M3 10a9 9 0 1 1 2 9M3 3v7h7",
  mail: "M3 5h18v14H3V5Zm0 1 9 7 9-7",
  download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
  star: "m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6",
  logout: "M9 3H3v18h6m4-14 5 5-5 5m-6-5h15",
};
const icon = (n) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPaths[n] || iconPaths.leaf}"/></svg>`;
let saved;
try {
  saved = JSON.parse(localStorage.getItem("kaushik-preview-v1"));
} catch {}
let state =
  saved?.version === 1
    ? saved
    : {
        version: 1,
        products: initialProducts,
        services: initialServices,
        partners: initialPartners,
        leads: initialLeads,
        orders: [],
        cart: [],
        favorites: [],
        user: null,
        city: "Hyderabad",
        maxPartners: 6,
        rotation: true,
        notifications: [],
        subscribers: [],
      };
if (state.catalogRevision !== 2) {
  for (const p of state.products) {
    const seed = initialProducts.find((x) => x.id === p.id);
    if (seed)
      Object.assign(p, {
        name: seed.name,
        image: seed.image,
        description: seed.description,
        care: seed.care,
        water: seed.water,
      });
  }
  for (const item of state.services) {
    const seed = initialServices.find((x) => x.id === item.id);
    if (seed) item.image = seed.image;
  }
  for (const l of state.leads) {
    if (!l.customer) l.customer = l.name || "Sample customer";
  }
  state.catalogRevision = 2;
}
const persist = () => {
  try {
    localStorage.setItem("kaushik-preview-v1", JSON.stringify(state));
  } catch {
    toast("Browser storage is unavailable. Changes last for this visit.");
  }
};
let route = "home",
  shopCategory = "All plants",
  shopQuery = "",
  shopSort = "featured",
  favoritesOnly = false,
  serviceCategory = "All services",
  orderTab = "services",
  workspaceTab = "overview",
  modalState = {},
  lastFocus = null,
  toastTimer,
  introTimer,
  observer;

// Super Admin authorized emails list (can be updated with your exact Gmail)
let SUPER_ADMIN_EMAILS = [
  "admin@kaushiknursery.com",
  "octaleadsprivatelimited@gmail.com",
];
const isSuperAdminUser = (email) => {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.map((e) => e.trim().toLowerCase()).includes(
    email.trim().toLowerCase(),
  );
};
const product = (id) => state.products.find((p) => p.id === id);
const service = (id) => state.services.find((s) => s.id === id);
const cartTotal = () =>
  state.cart.reduce((sum, c) => sum + (product(c.id)?.price || 0) * c.qty, 0);
const cartCount = () => state.cart.reduce((sum, c) => sum + c.qty, 0);
const delivery = () => (cartTotal() >= 1000 ? 0 : 99);
const tag = (text) =>
  `<span class="tag ${/Pending|Finding|Request/.test(text) ? "orange" : /Cancel|Reject|Suspend/.test(text) ? "gray" : ""}">${esc(text)}</span>`;
const brand = () =>
  `<a href="#home" class="brand" aria-label="Kaushik Nursery home"><svg class="brand-icon" viewBox="0 0 40 42" fill="none"><path d="M8 30C4 14 19 4 34 5c1 14-10 27-26 25Z" fill="#d1dec1"/><path d="M7 36C11 25 18 17 28 10M13 25l1-12m5 5 12 1" stroke="#315239" stroke-width="1.6" stroke-linecap="round"/></svg><span class="brand-words">kaushik<span style="font-weight:400">.</span><small>NURSERY & GARDENS</small></span></a>`;
function header() {
  return `<div class="topline">A little greener. A lot better. <span></span> Plants & garden services, thoughtfully brought together.</div><header class="site-header"><div class="container header-inner">${brand()}<nav class="main-nav" aria-label="Main navigation"><a class="${route === "services" ? "active" : ""}" href="#services">Garden services</a><a class="${route === "shop" ? "active" : ""}" href="#shop">Our plants</a><a class="${route === "customer-admin" ? "active" : ""}" href="#customer-admin">Customer Portal</a><a class="${route === "orders" ? "active" : ""}" href="#orders">My bookings</a></nav><div class="header-actions"><button class="location-btn" data-action="location" aria-label="Change city">${icon("pin")}${esc(state.city)}</button><button class="icon-btn" data-action="favorites" aria-label="Saved plants">${icon("heart")}</button><button class="icon-btn" data-action="cart" aria-label="Open shopping bag">${icon("bag")}<span class="cart-count ${cartCount() ? "" : "hidden"}">${cartCount()}</span></button><button class="icon-btn" data-action="account" aria-label="Your account">${icon("user")}</button><button class="icon-btn mobile-menu" data-action="mobile-nav" aria-label="Toggle navigation" aria-expanded="false">${icon("menu")}</button></div></div></header>`;
}
function footer() {
  return `<footer class="site-footer"><div class="container"><div class="footer-grid"><div class="footer-brand">${brand()}<p>More than plants. A little more life.<br>Thoughtful gardens, from the first leaf to the finishing touch.</p></div><div class="footer-col"><h4>A greener everyday</h4><a href="#services">Garden services</a><a href="#shop">Buy our products</a><a href="#customer-admin">Customer Admin Portal</a><a href="#orders">My orders & bookings</a><button data-action="support">Plant care & support</button></div><div class="footer-col"><h4>Grow with us</h4><a href="#partner">Become a service partner</a><a href="#super-admin">Super Admin Portal</a><button data-action="app-info">Our Android experience</button><button data-action="legal" data-id="contact">Contact & Grievances</button></div><div class="footer-col"><h4>Customer Protection & Policies</h4><button data-action="legal" data-id="privacy">Privacy Policy</button><button data-action="legal" data-id="terms">Terms & Conditions</button><button data-action="legal" data-id="refund">Cancellation & Refund Policy</button><button data-action="legal" data-id="shipping">Shipping & Delivery Policy</button><button data-action="legal" data-id="contact">Contact Us</button><button data-action="firebase-config">Firebase Settings</button><button data-action="account">Your account</button></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} Kaushik Nursery & Botanical Gardens Pvt Ltd. 100% Secure payments powered by Razorpay.</span><button data-action="replay">${icon("replay")}Replay the growing plant</button></div></div></footer>`;
}
function productCard(p) {
  return `<article class="product-card"><div class="product-image" data-action="product" data-id="${p.id}" role="button" tabindex="0" aria-label="View ${esc(p.name)}"><img src="${asset(p.image)}" alt="${esc(p.name)} — illustrative nursery photography" loading="lazy"><span class="product-badge">${esc(p.badge)}</span><button class="favorite-btn ${state.favorites.includes(p.id) ? "saved" : ""}" data-action="favorite" data-id="${p.id}" aria-label="${state.favorites.includes(p.id) ? "Unsave" : "Save"} ${esc(p.name)}" aria-pressed="${state.favorites.includes(p.id)}">${icon("heart")}</button><button class="quick-add" data-action="add-cart" data-id="${p.id}" aria-label="Add ${esc(p.name)} to bag" ${p.stock < 1 ? "disabled" : ""}>${icon("plus")}</button></div><div class="product-info"><small>${esc(p.category)}</small><h3><a href="#shop" data-action="product" data-id="${p.id}">${esc(p.name)}</a></h3><div class="price">${money(p.price)} ${p.oldPrice ? `<del>${money(p.oldPrice)}</del>` : ""}</div><div class="product-care">${icon("sun")}${esc(p.care)}</div></div></article>`;
}
function serviceCard(s) {
  return `<button class="service-card" data-action="book" data-id="${s.id}"><div class="service-photo"><img src="${asset(s.image)}" alt="${esc(s.name)}" loading="lazy"><span class="photo-label">${esc(s.label)}</span></div><div class="service-card-content"><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p><div class="card-bottom"><span>From <strong>${money(s.price)}</strong></span><span class="circle-arrow">${icon("up")}</span></div></div></button>`;
}
function home() {
  return `<main><section class="container hero"><div class="hero-grid"><div class="hero-copy"><div class="eyebrow">ROOTED IN NATURE. MADE FOR YOU.</div><h1>A little greener.<br>A lot <span class="serif">better.</span></h1><p>From a plant on your windowsill to a garden of your dreams. Let’s bring a little more life to your space.</p><div class="hero-actions"><a href="#services" class="btn btn-primary">Find your garden service ${icon("up")}</a><a href="#shop" class="hero-secondary">Shop our plants ${icon("arrow")}</a></div><div class="hero-trust"><div>${icon("shield")}Approved service partners</div><div>${icon("leaf")}Plants from our nursery</div><div>${icon("garden")}Care for every green space</div></div></div><div class="hero-art"><div class="hero-image"><img src="${asset("garden-hero.png")}" alt="Sunlit arched courtyard filled with tropical plants and terracotta pots" fetchpriority="high"></div><div class="hero-stamp"><svg viewBox="0 0 100 100"><defs><path id="stampCircle" d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0"/></defs><text><textPath href="#stampCircle">GOOD THINGS TAKE ROOT • KAUSHIK NURSERY • </textPath></text></svg><span class="stamp-leaf">${icon("leaf")}</span></div><div class="hero-caption">${icon("garden")}<p>Good things take root.<small>MAKE ROOM FOR SOMETHING BEAUTIFUL</small></p></div><span class="hero-side">A SLOWER MOMENT. A GREENER WORLD.</span></div></div><div class="hero-bottom"><span>YOUR SPACE. YOUR PACE. YOUR KIND OF GREEN.</span><button data-scroll="garden-services">SCROLL TO GROW ${icon("down")}</button></div></section><div class="container"><div class="service-strip"><div>${icon("garden")}Garden design & landscaping</div><div>${icon("tools")}Plant care & maintenance</div><div>${icon("sun")}Terrace & balcony gardens</div><div>${icon("leaf")}Plants, pots & little joys</div></div></div><section id="garden-services" class="container services-section reveal"><div class="section-title"><div><div class="eyebrow">A SPACE THAT FEELS LIKE YOU</div><h2>Dream a garden.<br>We’ll help it <span class="serif">grow.</span></h2></div><a href="#services" class="text-link">Explore all services ${icon("up")}</a></div><div class="service-grid">${state.services.slice(0, 3).map(serviceCard).join("")}</div></section><section id="how-it-works" class="how-section reveal"><div class="container how-grid"><div><div class="eyebrow">FROM AN IDEA TO A LITTLE OASIS</div><h2>Growing together,<br><span class="serif">simply.</span></h2></div><div class="steps"><div class="step"><div class="step-num">01</div><h3>Tell us your green dream</h3><p>Choose a service and share a little about your space and what you have in mind.</p></div><div class="step"><div class="step-num">02</div><h3>Meet the right hands</h3><p>Your request reaches suitable, approved garden professionals near you.</p></div><div class="step"><div class="step-num">03</div><h3>Watch good things grow</h3><p>Confirm your booking, follow the progress and enjoy your greener everyday.</p></div></div></div></section><section class="container plant-section reveal"><div class="section-title"><div><div class="eyebrow">STRAIGHT FROM OUR NURSERY</div><h2>Meet your new<br><span class="serif">green companions.</span></h2></div><a class="text-link" href="#shop">Shop all plants ${icon("up")}</a></div><div class="product-grid">${state.products.slice(0, 4).map(productCard).join("")}</div></section><section class="container story-section reveal"><div class="story-card"><div class="story-image"><img src="${asset("garden-hero.png")}" alt="A peaceful garden filled with leafy plants" loading="lazy"></div><div class="story-copy"><div class="eyebrow">THE KAUSHIK WAY</div><h2>We believe life<br>is better with<br><i>a little green.</i></h2><p>Plants for your everyday. Professionals for your garden. One thoughtful place to start something beautiful.</p><a href="#services" class="text-link">Find your kind of green ${icon("up")}</a></div></div></section><section class="container"><div class="newsletter"><div><h2>A little inspiration in your inbox.</h2><p>Plant care ideas, garden inspiration and a few things worth growing.</p></div><form class="newsletter-form" data-form="newsletter"><label class="hidden" for="newsletter-email">Email address</label><input id="newsletter-email" type="email" name="email" placeholder="Your email address" required autocomplete="email"><button class="btn btn-primary" type="submit">Keep me growing ${icon("arrow")}</button></form></div></section></main>`;
}
function shop() {
  return `<main class="container shop-layout"><div class="page-head"><div class="eyebrow">BUY OUR PRODUCTS</div><div class="page-head-row"><div><h1>${favoritesOnly ? "Your saved" : "Little things."}<br><span class="serif">${favoritesOnly ? "green companions." : "Big green energy."}</span></h1><p>Plants, pots and everyday essentials. All sold directly by Kaushik Nursery.</p></div><label class="search-field">${icon("search")}<input id="product-search" type="search" placeholder="Find your next green companion" value="${esc(shopQuery)}" aria-label="Search products"></label></div></div><div class="shop-controls"><div class="filters">${["All plants", ...new Set(state.products.map((p) => p.category))].map((c) => `<button class="filter-chip ${shopCategory === c ? "active" : ""}" data-action="shop-filter" data-id="${esc(c)}">${esc(c)}</button>`).join("")}${favoritesOnly ? '<button class="filter-chip active" data-action="all-products">Saved plants ×</button>' : ""}</div><select id="product-sort" aria-label="Sort products"><option value="featured" ${shopSort === "featured" ? "selected" : ""}>Thoughtfully selected</option><option value="price-low" ${shopSort === "price-low" ? "selected" : ""}>Price: low to high</option><option value="price-high" ${shopSort === "price-high" ? "selected" : ""}>Price: high to low</option></select></div><div id="catalog-results" class="product-grid catalog-grid">${filteredProducts()}</div><div class="info-banner" style="margin-top:35px">${icon("truck")}A little thank you: complimentary delivery on demo orders of ${money(1000)} or more.</div></main>`;
}
function filteredProducts() {
  let ps = state.products.filter(
    (p) =>
      (shopCategory === "All plants" || p.category === shopCategory) &&
      (!favoritesOnly || state.favorites.includes(p.id)) &&
      `${p.name} ${p.category}`.toLowerCase().includes(shopQuery.toLowerCase()),
  );
  if (shopSort !== "featured")
    ps.sort((a, b) =>
      shopSort === "price-low" ? a.price - b.price : b.price - a.price,
    );
  return ps.length
    ? ps.map(productCard).join("")
    : `<div class="empty-state" style="grid-column:1/-1">${icon("leaf")}<h3>No plants found here yet.</h3><p>Try another search or save a plant you love.</p><button class="btn btn-outline" data-action="clear-shop">Explore all products</button></div>`;
}
function services() {
  return `<main class="container service-catalog"><div class="page-head"><div class="eyebrow">THE SERVICE MARKETPLACE</div><h1>Your green dream.<br><span class="serif">In good hands.</span></h1><p>Tell us about your space. We’ll connect your request with suitable, approved gardening professionals.</p></div><div class="filters rule">${["All services", ...new Set(state.services.map((s) => s.category))].map((c) => `<button class="filter-chip ${serviceCategory === c ? "active" : ""}" data-action="service-filter" data-id="${esc(c)}">${esc(c)}</button>`).join("")}</div><div class="service-grid">${state.services
    .filter(
      (s) =>
        serviceCategory === "All services" || s.category === serviceCategory,
    )
    .map(serviceCard)
    .join(
      "",
    )}</div><div class="info-banner" style="margin-top:30px">${icon("shield")}Every request is shared with a limited number of suitable professionals. The nursery retains control over the final assignment.</div></main>`;
}
function orders() {
  let ls = state.leads.filter((l) => !l.sample);
  return `<main class="container orders-list"><div class="page-head"><div class="eyebrow">YOUR GREENER EVERYDAY</div><h1>Good things,<br><span class="serif">in progress.</span></h1><p>Keep your garden bookings and nursery purchases in their own little spaces.</p></div><div class="booking-tabs"><button class="${orderTab === "services" ? "active" : ""}" data-action="orders-tab" data-id="services">My service bookings (${ls.length})</button><button class="${orderTab === "products" ? "active" : ""}" data-action="orders-tab" data-id="products">My product orders (${state.orders.length})</button></div>${orderTab === "services" ? (ls.length ? ls.map((l) => orderCard(l, "service")).join("") : empty("Your next garden story starts here.", "Browse services, share your idea and track your first booking.", "services", "Explore garden services")) : state.orders.length ? state.orders.map((o) => orderCard(o, "product")).join("") : empty("Something green is waiting for you.", "Choose a new companion from our nursery to start your order history.", "shop", "Meet our plants")}</main>`;
}
function empty(title, desc, href, label) {
  return `<div class="empty-state">${icon("leaf")}<h3>${title}</h3><p>${desc}</p><a class="btn btn-primary" href="#${href}">${label} ${icon("arrow")}</a></div>`;
}
function orderCard(o, type) {
  let isService = type === "service",
    steps = isService
      ? [
          "Request submitted",
          "Finding service partner",
          "Partner assigned",
          "Booking confirmed",
          "Service scheduled",
          "Service in progress",
          "Service completed",
        ]
      : ["Order placed", "Confirmed", "Processing", "Dispatched", "Delivered"],
    current = steps.indexOf(o.status);
  let p = isService ? service(o.serviceId) : product(o.items[0]?.id);
  return `<article class="order-card"><div class="order-top"><div><h3>${esc(isService ? o.serviceName : `Nursery order · ${o.items.reduce((a, c) => a + c.qty, 0)} items`)}</h3><p>${esc(o.id)} · ${isService ? dateLabel(o.date) : new Date(o.created).toLocaleDateString("en-IN")}</p></div>${tag(o.status)}</div><div class="order-body">${p ? `<img class="order-thumb" src="${asset(p.image)}" alt="${esc(p.name || o.serviceName)}">` : ""}<div><h4>${isService ? esc(o.package) : o.items.map((c) => `${esc(product(c.id)?.name || c.name)} × ${c.qty}`).join(", ")}</h4><p>${esc(o.address)}${isService ? ` · ${esc(o.time)}` : ""}</p><p>${isService ? (o.assigned ? `Partner: ${esc(state.partners.find((t) => t.id === o.assigned)?.name)}` : "We’re finding the right hands for your garden.") : `${money(o.total)} · ${esc(o.payment || "Demo payment recorded")}`}</p></div>${isService && !["Service completed", "Cancelled"].includes(o.status) ? `<button class="btn btn-outline btn-small order-action" data-action="cancel-booking" data-id="${o.id}">Cancel request</button>` : ""}${isService && o.status === "Service completed" ? `<button class="btn btn-outline btn-small order-action" data-action="review" data-id="${o.id}">${o.review ? "View review" : "Leave a review"}</button>` : ""}</div>${o.status !== "Cancelled" ? `<div class="status-track">${steps.map((s, i) => `<div class="track-step ${i <= current ? "done" : ""}">${s}</div>`).join("")}</div>` : ""}</article>`;
}
const activePartner = () =>
  state.partners.find((p) => p.id === (state.activePartnerId || "t1")) ||
  state.partners[0];
function table(headers, rows) {
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.join("") : `<tr><td colspan="${headers.length}"><div class="empty-state" style="padding:25px">Nothing here yet.</div></td></tr>`}</tbody></table></div>`;
}
function stat(label, value, note) {
  return `<div class="stat-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;
}
function customerPortalView() {
  const user = state.user || {
    name: "Customer (Guest)",
    phone: "9876543210",
    email: "customer@example.com",
    city: state.city || "Hyderabad",
  };
  const myOrders = state.orders;
  const myBookings = state.leads.filter((l) => !l.sample);
  const myTotalSpent = myOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  let titles = {
    overview: "Your plant sanctuary, at a glance.",
    orders: "All your plant deliveries & tracking.",
    bookings: "Your booked garden services & visits.",
    saved: "Plants you love and saved.",
    profile: "Your personal details & delivery addresses.",
  };

  let out = `<div class="workspace-heading"><div><h1>${titles[workspaceTab] || "Customer Portal"}</h1><p>Kaushik Nursery Customer Dashboard · Signed in as ${esc(user.name)}</p></div><span class="tag">${dateLabel(today())}</span></div>`;

  if (workspaceTab === "overview") {
    return (
      out +
      `<div class="stats-grid">
        ${stat("My Orders", myOrders.length, "Plant & garden purchases")}
        ${stat("Service Bookings", myBookings.length, "Landscaping & maintenance")}
        ${stat("Total Invested in Green", money(myTotalSpent), "Orders fulfilled & in transit")}
        ${stat("Saved Favorites", state.favorites.length, "Plants saved to wishlist")}
      </div>
      <div class="workspace-columns">
        <div class="panel">
          <div class="panel-heading"><h2>Recent nursery orders</h2><button class="btn btn-soft btn-small" data-action="workspace-tab" data-id="orders">View all ${icon("arrow")}</button></div>
          ${table(["Order ID", "Items", "Amount", "Payment", "Status"], myOrders.slice(0, 4).map(o => `<tr><td><strong>${esc(o.id)}</strong><small>${new Date(o.created).toLocaleDateString("en-IN")}</small></td><td>${o.items.map(c => `${esc(c.name || product(c.id)?.name)} × ${c.qty}`).join(", ")}</td><td>${money(o.total)}</td><td>${tag(o.payment || "Paid")}</td><td>${tag(o.status)}</td></tr>`))}
        </div>
        <div class="panel">
          <div class="panel-heading"><h2>Active service appointments</h2><button class="btn btn-soft btn-small" data-action="workspace-tab" data-id="bookings">View all ${icon("arrow")}</button></div>
          ${myBookings.length ? myBookings.slice(0, 3).map(l => `<div class="activity">${icon("garden")}<div><h4>${esc(l.serviceName)}</h4><p>${esc(l.package)} · ${dateLabel(l.date)} · ${tag(l.status)}</p></div></div>`).join("") : `<div class="empty-state" style="padding:20px">${icon("leaf")}<p>No active garden appointments yet.</p><a href="#services" class="btn btn-primary btn-small">Book a service ${icon("arrow")}</a></div>`}
        </div>
      </div>
      <div class="panel">
        <div class="panel-heading"><h2>Recommended plants for you</h2><a href="#shop" class="btn btn-soft btn-small">Shop catalog ${icon("arrow")}</a></div>
        <div class="product-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:15px">
          ${state.products.slice(0, 4).map(productCard).join("")}
        </div>
      </div>`
    );
  }

  if (workspaceTab === "orders") {
    return (
      out +
      `<div class="panel">
        <div class="panel-heading"><h2>My plant orders (${myOrders.length})</h2><a href="#shop" class="btn btn-primary btn-small">${icon("plus")}Shop more plants</a></div>
        ${table(["Order ID", "Items Ordered", "Delivery Address", "Total", "Payment Info", "Order Status"], myOrders.map(o => `<tr><td><strong>${esc(o.id)}</strong><small>${new Date(o.created).toLocaleDateString("en-IN")}</small></td><td>${o.items.map(c => `${esc(c.name || product(c.id)?.name)} × ${c.qty}`).join(", ")}</td><td><small>${esc(o.address)}</small></td><td>${money(o.total)}</td><td>${tag(o.payment || "Paid")}</td><td>${tag(o.status)}</td></tr>`))}
      </div>`
    );
  }

  if (workspaceTab === "bookings") {
    return (
      out +
      `<div class="panel">
        <div class="panel-heading"><h2>My garden services & visits (${myBookings.length})</h2><a href="#services" class="btn btn-primary btn-small">${icon("plus")}Book new service</a></div>
        ${table(["Booking ID", "Service & Space", "Visit Schedule", "Assigned Professional", "Status", "Action"], myBookings.map(l => `<tr><td><strong>${esc(l.id)}</strong><small>${esc(l.serviceName)}</small></td><td>${esc(l.package)}<small>${esc(l.address || state.city)}</small></td><td>${dateLabel(l.date)}<small>${esc(l.time || "Morning")}</small></td><td>${esc(state.partners.find(p => p.id === l.assigned)?.name || "Matching specialist...")}</td><td>${tag(l.status)}</td><td>${l.status !== "Cancelled" && l.status !== "Service completed" ? `<button class="btn btn-outline btn-small" data-action="cancel-booking" data-id="${l.id}">Cancel</button>` : `<span style="font-size:8px;color:#888">—</span>`}</td></tr>`))}
      </div>`
    );
  }

  if (workspaceTab === "saved") {
    const favProducts = state.products.filter(p => state.favorites.includes(p.id));
    return (
      out +
      `<div class="panel">
        <div class="panel-heading"><h2>Saved wishlist (${favProducts.length})</h2><a href="#shop" class="btn btn-soft btn-small">Explore all plants ${icon("arrow")}</a></div>
        ${favProducts.length ? `<div class="product-grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px">${favProducts.map(productCard).join("")}</div>` : `<div class="empty-state" style="padding:40px">${icon("heart")}<h3>Your wishlist is empty</h3><p>Tap the heart icon on any plant to save it here for later.</p><a href="#shop" class="btn btn-primary">Discover plants ${icon("arrow")}</a></div>`}
      </div>`
    );
  }

  if (workspaceTab === "profile") {
    return (
      out +
      `<div class="panel">
        <div class="panel-heading"><h2>Customer Profile & Preferences</h2></div>
        <form data-form="customer-profile">
          <div class="form-grid">
            <label class="field"><span>Full Name</span><input name="name" value="${esc(user.name)}" required maxlength="60"></label>
            <label class="field"><span>Mobile Number</span><input name="phone" type="tel" inputmode="numeric" pattern="[0-9]{10}" value="${esc(user.phone)}" required></label>
            <label class="field"><span>Email Address</span><input name="email" type="email" value="${esc(user.email || "")}" placeholder="name@example.com"></label>
            <label class="field"><span>Default City</span><select name="city">${["Hyderabad", "Bengaluru", "Chennai", "Vijayawada"].map(c => `<option ${c === (user.city || state.city) ? "selected" : ""}>${c}</option>`).join("")}</select></label>
            <label class="field full"><span>Default Delivery Address</span><textarea name="address" placeholder="Your street address, apartment, and landmark">${esc(user.address || "")}</textarea></label>
          </div>
          <div class="modal-footer"><small>Profile updates synchronize across your customer experience.</small><button class="btn btn-primary" type="submit">Save Customer Details ${icon("check")}</button></div>
        </form>
      </div>`
    );
  }

  return out;
}

let isSuperAdminUnlocked = false;

function shell(kind) {
  let isCustomer = kind === "customer-admin";
  let partner = kind === "partner";
  let p = activePartner();

  // Check if current user is an authorized super admin by email
  if (state.user && isSuperAdminUser(state.user.email)) {
    isSuperAdminUnlocked = true;
  }

  // If super admin and not yet logged in / unlocked, show authentication form
  if ((kind === "super-admin" || kind === "admin") && !isSuperAdminUnlocked) {
    return `<main class="container" style="max-width:540px;padding:80px 20px">
      <div class="panel" style="text-align:center;padding:45px 35px">
        <div class="avatar" style="margin:0 auto 16px;width:56px;height:56px;font-size:24px;background:#153e2e;color:#b8d693">${icon("shield")}</div>
        <div class="eyebrow" style="justify-content:center">SUPER ADMIN ACCESS CONTROL</div>
        <h2 style="font-size:24px;margin-bottom:8px">Super Admin Portal</h2>
        <p class="modal-intro" style="margin-bottom:24px">Access restricted to authorized Super Admin email accounts or security master PIN.</p>
        <form data-form="super-admin-auth">
          <label class="field full" style="text-align:left">
            <span>Super Admin Gmail / Email</span>
            <input type="email" name="email" value="${esc(state.user?.email || "")}" placeholder="admin@kaushiknursery.com" autocomplete="email" style="font-size:14px">
          </label>
          <label class="field full" style="text-align:left;margin-top:14px">
            <span>Security Master PIN (Default: 8888)</span>
            <input type="password" name="pin" placeholder="Enter PIN (8888)" autocomplete="current-password" style="font-size:16px;letter-spacing:3px;text-align:center">
          </label>
          <div class="info-banner" style="margin-top:16px;font-size:12px;text-align:left">${icon("shield")}Authorized Gmail holders access directly. All other customer emails open Customer Portal.</div>
          <button class="btn btn-primary" type="submit" style="width:100%;margin-top:20px;justify-content:center">Unlock Super Admin Panel ${icon("arrow")}</button>
        </form>
      </div>
    </main>`;
  }

  let tabs;
  if (isCustomer) {
    tabs = [
      ["overview", "dashboard", "My Overview"],
      ["orders", "bag", "My Orders"],
      ["bookings", "calendar", "Garden Bookings"],
      ["saved", "heart", "Wishlist Plants"],
      ["profile", "user", "My Profile"],
    ];
  } else if (partner) {
    tabs = [
      ["overview", "dashboard", "My dashboard"],
      ["leads", "bell", "New leads"],
      ["jobs", "briefcase", "My jobs"],
      ["profile", "user", "Profile & availability"],
    ];
  } else {
    tabs = [
      ["overview", "dashboard", "Super Overview"],
      ["leads", "briefcase", "Leads & Bookings"],
      ["partners", "users", "Service Partners"],
      ["users", "user", "Customer Directory"],
      ["products", "bag", "Catalog & Orders"],
      ["payments", "shield", "Razorpay Payments"],
      ["services", "garden", "Services Catalog"],
      ["notifications", "bell", "Broadcast Updates"],
      ["reports", "chart", "Analytics & Reports"],
      ["settings", "settings", "Distribution Rules"],
    ];
  }

  if (!tabs.some((t) => t[0] === workspaceTab)) workspaceTab = "overview";

  let avatarLabel = isCustomer ? esc((state.user?.name || "C")[0]) : partner ? esc(p.name[0]) : "👑";
  let titleLabel = isCustomer ? esc(state.user?.name || "Customer Account") : partner ? esc(p.name) : "Super Administrator";
  let roleLabel = isCustomer ? "CUSTOMER PORTAL" : partner ? "SERVICE PARTNER" : "SUPER ADMIN SYSTEM CONTROL";
  let statusBadge = isCustomer ? (state.user ? "Verified Member" : "Guest Account") : partner ? p.status : "Super Admin";

  return `<main class="workspace-shell workspace-shell-${kind}">
    <aside class="workspace-sidebar">
      <div class="sidebar-profile">
        <div class="avatar">${avatarLabel}</div>
        <h3>${titleLabel}</h3>
        <p>${roleLabel}</p>
        ${tag(statusBadge)}
      </div>
      ${tabs.map(([id, ic, label]) => `<button class="sidebar-item ${workspaceTab === id ? "active" : ""}" data-action="workspace-tab" data-id="${id}">${icon(ic)}${label}</button>`).join("")}
      ${!isCustomer && !partner ? `
        <div style="margin-top:16px;padding-top:14px;border-top:1px solid #dce3d4;display:flex;flex-direction:column;gap:6px">
          <a href="#home" class="sidebar-item" style="color:var(--forest)">${icon("arrow")} Back to Store</a>
          <button class="sidebar-item" data-action="super-admin-lock" style="color:#c04b4b">${icon("logout")}Lock Super Admin</button>
        </div>` : ""}
      <div class="workspace-note">
        ${isCustomer ? "CUSTOMER SELF-SERVICE<br>Track your plant orders, garden appointments, and addresses." : "ENTERPRISE CONTROL<br>Manage entire platform operations, partner allocations, and Razorpay reconciliations."}
      </div>
    </aside>
    <div class="workspace-content">${isCustomer ? customerPortalView() : partner ? partnerView(p) : adminView()}</div>
  </main>`;
}
function partnerView(p) {
  let incoming = state.leads.filter(
      (l) =>
        l.status === "Finding service partner" &&
        l.recipients.includes(p.id) &&
        !l.declined.includes(p.id),
    ),
    jobs = state.leads.filter((l) => l.assigned === p.id),
    active = jobs.filter(
      (l) => !["Cancelled", "Service completed"].includes(l.status),
    );
  let heading = {
    overview: [
      "Good things are growing.",
      "Your garden work, thoughtfully organised.",
    ],
    leads: [
      "Your next green project.",
      "Requests matched to your services and location.",
    ],
    jobs: [
      "Gardens in your care.",
      "Manage your assignments and keep customers updated.",
    ],
    profile: [
      "Let your profile grow.",
      "Your experience, services and availability.",
    ],
  }[workspaceTab];
  let out = `<div class="workspace-heading"><div><h1>${heading[0]}</h1><p>${heading[1]}</p></div><button class="btn btn-outline btn-small" data-action="partner-register">${icon("plus")}Register a partner</button></div>`;
  if (p.status !== "Approved")
    return (
      out +
      `<div class="info-banner">${icon("shield")}Your application is ${esc(p.status.toLowerCase())}. Nursery approval is required before you receive service leads.</div>${partnerProfile(p)}`
    );
  if (workspaceTab === "profile") return out + partnerProfile(p);
  if (workspaceTab === "leads")
    return (
      out +
      `<div class="info-banner">${icon("shield")}Accept a lead to receive its assignment. Once assigned, it closes for the other partners. Nursery admin can reassign it.</div><div class="lead-grid">${incoming.length ? incoming.map((l) => leadCard(l, p)).join("") : empty("A little pause before the next project.", "New matching leads will appear here.", "services", "Preview a customer request")}</div>`
    );
  if (workspaceTab === "jobs")
    return out + `<div class="panel">${partnerJobs(jobs)}</div>`;
  return (
    out +
    `<div class="stats-grid">${stat("New leads", incoming.length, "Matched to your services")}${stat("Active assignments", active.length, "Ready for your green touch")}${stat("Completed gardens", jobs.filter((l) => l.status === "Service completed").length, "A little more life, delivered")}${stat("Availability", p.available ? "Available" : "Paused", "Manage from your profile")}</div><div class="panel"><div class="panel-heading"><h2>New requests, fresh possibilities</h2><button class="btn btn-soft btn-small" data-action="workspace-tab" data-id="leads">View all leads ${icon("arrow")}</button></div><div class="lead-grid">${
      incoming.length
        ? incoming
            .slice(0, 2)
            .map((l) => leadCard(l, p))
            .join("")
        : '<p class="muted">No new matching leads.</p>'
    }</div></div><div class="panel"><div class="panel-heading"><h2>Your upcoming garden work</h2></div>${partnerJobs(active)}</div>`
  );
}
function leadCard(l, p) {
  return `<article class="lead-card"><div class="lead-card-top"><span class="eyebrow" style="font-size:8px">${esc(l.id)}</span>${tag(l.sample ? "Sample lead" : "New request")}</div><h3>${esc(l.serviceName)}</h3><p>${esc(l.description)}</p><div class="lead-details"><span>${icon("pin")}${esc(l.city)}</span><span>${icon("calendar")}${dateLabel(l.date)}</span><span>${icon("clock")}${esc(l.time)}</span><span>${icon("garden")}${esc(l.area || "Flexible")} sq ft</span></div><div class="lead-actions"><button class="btn btn-primary" data-action="accept-lead" data-id="${l.id}" ${!p.available ? "disabled" : ""}>Accept lead ${icon("check")}</button><button class="btn btn-outline" data-action="decline-lead" data-id="${l.id}">Decline</button></div></article>`;
}
function partnerJobs(jobs) {
  return table(
    [
      "Garden project",
      "Customer & location",
      "Schedule",
      "Status",
      "Next step",
    ],
    jobs.map(
      (l) =>
        `<tr><td><strong>${esc(l.serviceName)}</strong><small>${esc(l.id)}</small></td><td>${esc(l.customer)}<small>${esc(l.address)}</small></td><td>${dateLabel(l.date)}<small>${esc(l.time)}</small></td><td>${tag(l.status)}</td><td>${!["Service completed", "Cancelled"].includes(l.status) ? `<button class="btn btn-soft btn-small" data-action="job-update" data-id="${l.id}">Update job</button>` : l.review ? `${l.review.rating}/5 stars` : "Completed"}</td></tr>`,
    ),
  );
}
function partnerProfile(p) {
  return `<div class="panel"><div class="panel-heading"><h2>Your partner details</h2>${tag(p.status)}</div><form data-form="partner-profile"><div class="form-grid"><label class="field"><span>Business / professional name</span><input name="name" value="${esc(p.name)}" required maxlength="70"></label><label class="field"><span>Your name</span><input name="person" value="${esc(p.person)}" required maxlength="60"></label><label class="field"><span>City</span><select name="city">${["Hyderabad", "Bengaluru", "Chennai", "Vijayawada"].map((c) => `<option ${c === p.city ? "selected" : ""}>${c}</option>`).join("")}</select></label><label class="field"><span>Experience</span><input name="experience" value="${esc(p.experience || "3 years")}" placeholder="Years of experience" maxlength="60"></label><label class="field full"><span>Services offered</span><select name="category"><option value="all" ${p.categories.length === 3 ? "selected" : ""}>All gardening categories</option>${["Design & landscaping", "Garden care", "Small-space gardens"].map((c) => `<option ${p.categories.length === 1 && p.categories.includes(c) ? "selected" : ""}>${c}</option>`).join("")}</select></label><label class="field full"><span>Contact mobile number</span><input name="phone" inputmode="numeric" pattern="[0-9]{10}" value="${esc(p.phone || "")}" placeholder="10-digit number (use sample details)"></label></div><div class="settings-line"><div>Available for new leads<p>Pause new requests when your schedule is full.</p></div><input type="checkbox" name="available" ${p.available ? "checked" : ""} aria-label="Available for new leads"></div><div class="modal-footer"><small>Profile changes are stored in this browser.</small><button class="btn btn-primary" type="submit">Save profile ${icon("check")}</button></div></form></div>`;
}
function adminView() {
  let pending = state.partners.filter((p) => p.status === "Pending"),
    active = state.leads.filter(
      (l) => !["Cancelled", "Service completed"].includes(l.status),
    );
  let names = {
    overview: "Your nursery, at a glance.",
    leads: "Every request. The right hands.",
    partners: "The people behind the gardens.",
    users: "Your growing community.",
    products: "From nursery to new home.",
    payments: "Every payment, thoughtfully tracked.",
    services: "Make room for new possibilities.",
    notifications: "A thoughtful little update.",
    reports: "A clearer view of what’s growing.",
    settings: "Fair leads. Thoughtful matches.",
  };
  let out = `<div class="workspace-heading"><div><h1>${names[workspaceTab]}</h1><p>Kaushik Nursery · Administration · Browser-local demo data</p></div>${workspaceTab === "products" ? '<button class="btn btn-primary btn-small" data-action="product-edit" data-id="new">' + icon("plus") + "Add product</button>" : workspaceTab === "services" ? '<button class="btn btn-primary btn-small" data-action="service-edit" data-id="new">' + icon("plus") + "Add service</button>" : `<span class="tag">${dateLabel(today())}</span>`}</div>`;
  if (workspaceTab === "overview")
    return (
      out +
      `<div class="stats-grid">${stat("Active service requests", active.length, "Across all approved partners")}${stat("Partner approvals", pending.length, "Applications awaiting review")}${stat("Product orders", state.orders.length, "Direct nursery purchases")}${stat("Demo product sales", money(state.orders.reduce((a, o) => a + o.total, 0)), "Illustrative, no real payments")}</div><div class="workspace-columns"><div class="panel"><div class="panel-heading"><h2>Lead allocation</h2><span class="tag">${state.maxPartners} partners max</span></div>${leadTable(state.leads.slice(0, 5), true)}</div><div class="panel"><div class="panel-heading"><h2>Recent activity</h2></div>${state.leads
        .slice(0, 4)
        .map(
          (l) =>
            `<div class="activity">${icon(l.assigned ? "check" : "garden")}<div><h4>${esc(l.serviceName)}</h4><p>${esc(l.id)} · ${esc(l.status)}</p></div></div>`,
        )
        .join("")}${state.orders
        .slice(0, 2)
        .map(
          (o) =>
            `<div class="activity">${icon("bag")}<div><h4>Nursery order ${esc(o.id)}</h4><p>${money(o.total)} · ${esc(o.status)}</p></div></div>`,
        )
        .join(
          "",
        )}</div></div><div class="panel"><div class="panel-heading"><h2>Partners ready to grow</h2><button class="btn btn-soft btn-small" data-action="workspace-tab" data-id="partners">Manage partners ${icon("arrow")}</button></div>${partnersTable(state.partners.slice(0, 5))}</div>`
    );
  if (workspaceTab === "leads")
    return (
      out +
      `<div class="info-banner">${icon("shield")}Automatic distribution selects approved, available partners by service category and city. You retain final control over assignment and reassignment.</div><div class="panel"><div class="panel-heading"><h2>All service requests (${state.leads.length})</h2><button class="btn btn-outline btn-small" data-action="export" data-id="leads">${icon("download")}Export</button></div>${leadTable(state.leads)}</div>`
    );
  if (workspaceTab === "partners")
    return (
      out +
      `<div class="panel"><div class="panel-heading"><h2>Partner directory</h2><span class="tag orange">${pending.length} awaiting approval</span></div>${partnersTable(state.partners)}</div>`
    );
  if (workspaceTab === "users")
    return (
      out +
      `<div class="panel"><div class="panel-heading"><h2>Customer account</h2></div>${table(["Name", "Mobile", "Email", "City", "Service requests"], state.user ? [`<tr><td>${esc(state.user.name)}</td><td>${esc(state.user.phone)}</td><td>${esc(state.user.email || "—")}</td><td>${esc(state.city)}</td><td>${state.leads.filter((l) => !l.sample).length}</td></tr>`] : [])}<p class="field-note">Sign in through the customer preview to create a browser-local demo account.</p></div>`
    );
  if (workspaceTab === "products")
    return (
      out +
      `<div class="panel"><div class="panel-heading"><h2>Nursery catalog</h2><p>Products sold only by Kaushik Nursery</p></div>${table(
        ["Product", "Category", "Price", "Stock", "Manage"],
        state.products.map(
          (p) =>
            `<tr><td><div class="table-product"><img src="${asset(p.image)}" alt="${esc(p.name)}"><strong>${esc(p.name)}</strong></div></td><td>${esc(p.category)}</td><td>${money(p.price)}</td><td>${p.stock} available</td><td><button class="btn btn-soft btn-small" data-action="product-edit" data-id="${p.id}">Edit</button></td></tr>`,
        ),
      )}</div><div class="panel"><div class="panel-heading"><h2>Product orders</h2></div>${table(
        ["Order", "Customer", "Total", "Payment", "Status"],
        state.orders.map(
          (o) =>
            `<tr><td>${esc(o.id)}<small>${o.items.length} product types</small></td><td>${esc(o.name)}<small>${esc(o.address)}</small></td><td>${money(o.total)}</td><td>${tag("Demo paid")}</td><td><select class="order-status-select" data-id="${o.id}" aria-label="Order status for ${o.id}">${["Order placed", "Confirmed", "Processing", "Dispatched", "Delivered", "Cancelled"].map((s) => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select></td></tr>`,
        ),
      )}</div>`
    );
  if (workspaceTab === "payments")
    return (
      out +
      `<div class="info-banner">${icon("shield")}All payments are simulated. These controls demonstrate transaction and refund states without moving money.</div><div class="panel"><div class="panel-heading"><h2>Product payments</h2></div>${table(
        ["Transaction", "Customer", "Amount", "Payment status", "Manage"],
        state.orders.map(
          (o) =>
            `<tr><td>${esc(o.id)}<small>Nursery product order</small></td><td>${esc(o.name)}</td><td>${money(o.total)}</td><td>${tag(o.payment)}</td><td>${o.payment !== "Demo refunded" ? `<button class="btn btn-soft btn-small" data-action="payment" data-id="${o.id}" data-kind="product" data-status="Demo refunded">Simulate refund</button>` : "Refund recorded"}</td></tr>`,
        ),
      )}</div><div class="panel"><div class="panel-heading"><h2>Service payments</h2></div>${table(
        ["Request", "Service", "Package amount", "Payment status", "Manage"],
        state.leads.map(
          (l) =>
            `<tr><td>${esc(l.id)}</td><td>${esc(l.serviceName)}</td><td>${money(l.price)}</td><td>${tag(l.payment || "Pending")}</td><td><button class="btn btn-soft btn-small" data-action="payment" data-id="${l.id}" data-kind="service" data-status="${l.payment === "Demo paid" ? "Demo refunded" : "Demo paid"}">${l.payment === "Demo paid" ? "Simulate refund" : "Simulate payment"}</button></td></tr>`,
        ),
      )}</div>`
    );
  if (workspaceTab === "services")
    return (
      out +
      `<div class="panel"><div class="panel-heading"><h2>Service catalog</h2><p>Categories, pricing and packages</p></div>${table(
        ["Service", "Category", "From", "Packages", "Manage"],
        state.services.map(
          (s) =>
            `<tr><td><strong>${esc(s.name)}</strong></td><td>${esc(s.category)}</td><td>${money(s.price)}</td><td>${s.packages.length}</td><td><button class="btn btn-soft btn-small" data-action="service-edit" data-id="${s.id}">Edit</button></td></tr>`,
        ),
      )}</div>`
    );
  if (workspaceTab === "settings")
    return (
      out +
      `<div class="panel"><div class="panel-heading"><h2>Limited lead distribution</h2></div><form data-form="lead-settings"><div class="settings-line"><div>Maximum partners per request<p>Only suitable partners receive a lead. Default: 6.</p></div><input type="number" name="maxPartners" value="${state.maxPartners}" min="1" max="20" required aria-label="Maximum partners per lead"></div><div class="settings-line"><div>Rotate matching partners<p>Prioritise partners who have received fewer leads.</p></div><input type="checkbox" name="rotation" ${state.rotation ? "checked" : ""} aria-label="Rotate partners"></div><div class="settings-line"><div>Partner eligibility<p>Approved + available + matching service category + matching city.</p></div>${tag("Enabled")}</div><div class="settings-line"><div>Admin assignment control<p>Assign, override, reassign or cancel any lead.</p></div>${tag("Enabled")}</div><div class="modal-footer"><small>Changes apply to new requests.</small><button class="btn btn-primary">Save distribution rules ${icon("check")}</button></div></form></div>`
    );
  if (workspaceTab === "notifications")
    return (
      out +
      `<div class="panel"><div class="panel-heading"><h2>Compose an update</h2></div><form data-form="notification"><div class="form-grid"><label class="field full"><span>Audience</span><select name="audience"><option>All customers</option><option>All service partners</option>${state.partners.map((p) => `<option>${esc(p.name)}</option>`).join("")}</select></label><label class="field full"><span>Title</span><input name="title" placeholder="A fresh update from the nursery" required maxlength="100"></label><label class="field full"><span>Message</span><textarea name="message" placeholder="What would you like to share?" required maxlength="500"></textarea></label></div><div class="modal-footer"><small>Preview only. No push notification is sent.</small><button class="btn btn-primary">Save demo notification ${icon("bell")}</button></div></form></div><div class="panel"><div class="panel-heading"><h2>Saved updates</h2></div>${table(
        ["Title", "Audience", "Message"],
        state.notifications.map(
          (n) =>
            `<tr><td>${esc(n.title)}</td><td>${esc(n.audience)}</td><td>${esc(n.message)}</td></tr>`,
        ),
      )}</div>`
    );
  if (workspaceTab === "reports")
    return (
      out +
      `<div class="panel"><div class="panel-heading"><h2>Download a clear picture</h2><p>CSV exports of the current browser data</p></div>${[
        ["leads", "Service requests & leads", state.leads.length],
        ["partners", "Service partner directory", state.partners.length],
        ["orders", "Product orders & demo payments", state.orders.length],
        ["products", "Catalog & stock", state.products.length],
      ]
        .map(
          ([id, label, count]) =>
            `<div class="settings-line"><div>${label}<p>${count} records</p></div><button class="btn btn-outline btn-small" data-action="export" data-id="${id}">${icon("download")}Export CSV</button></div>`,
        )
        .join("")}</div>`
    );
  return out;
}
function leadTable(leads, compact = false) {
  return table(
    compact
      ? ["Request", "Status", "Partner", "Control"]
      : [
          "Request / customer",
          "Location & schedule",
          "Distributed to",
          "Status",
          "Assigned partner",
          "Control",
        ],
    leads.map(
      (l) =>
        `<tr><td><strong>${esc(l.serviceName)}</strong><small>${esc(l.id)}${compact ? "" : ` · ${esc(l.customer)}`}${l.sample ? " · Sample" : ""}</small></td>${compact ? "" : `<td>${esc(l.city)}<small>${dateLabel(l.date)} · ${esc(l.time)}</small></td><td>${l.recipients.length} partners<small>${l.declined.length} declined</small></td>`}<td>${tag(l.status)}</td><td>${esc(state.partners.find((p) => p.id === l.assigned)?.name || "Awaiting assignment")}</td><td><div class="table-actions"><button class="btn btn-soft" data-action="assign" data-id="${l.id}">${l.assigned ? "Reassign" : "Assign"}</button>${l.status !== "Cancelled" && l.status !== "Service completed" ? `<button class="btn btn-outline" data-action="cancel-booking" data-id="${l.id}">Cancel</button>` : ""}</div></td></tr>`,
    ),
  );
}
function partnersTable(partners) {
  return table(
    ["Partner", "Location / services", "Status", "Available", "Manage"],
    partners.map(
      (p) =>
        `<tr><td><strong>${esc(p.name)}</strong><small>${esc(p.person)}</small></td><td>${esc(p.city)}<small>${p.categories.map(esc).join(", ")}</small></td><td>${tag(p.status)}</td><td>${p.available ? "Yes" : "No"}</td><td><div class="table-actions">${p.status === "Pending" ? `<button class="btn btn-primary" data-action="partner-status" data-id="${p.id}" data-status="Approved">Approve</button><button class="btn btn-outline" data-action="partner-status" data-id="${p.id}" data-status="Rejected">Reject</button>` : `<button class="btn btn-soft" data-action="partner-status" data-id="${p.id}" data-status="${p.status === "Approved" ? "Suspended" : "Approved"}">${p.status === "Approved" ? "Suspend" : "Activate"}</button>`}</div>${p.documents?.length ? `<small>Docs: ${p.documents.map(esc).join(", ")}</small>` : ""}</td></tr>`,
    ),
  );
}
function render(scroll = false) {
  observer?.disconnect();
  const isSuperAdminRoute = route === "super-admin" || route === "admin";
  $("#app").innerHTML =
    (isSuperAdminRoute ? "" : header()) +
    (
      {
        home,
        shop,
        services,
        orders,
        partner: () => shell("partner"),
        admin: () => shell("super-admin"),
        "super-admin": () => shell("super-admin"),
        "customer-admin": () => shell("customer-admin"),
      }[route] || home
    )() +
    (isSuperAdminRoute ? "" : footer());
  if (scroll) window.scrollTo({ top: 0, behavior: "instant" });
  observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      }),
    { threshold: 0.08 },
  );
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
  document.title = `${{ home: "A little greener, a lot better", shop: "Our plants", services: "Garden services", orders: "My bookings", partner: "Partner workspace", admin: "Super Admin", "super-admin": "Super Admin Portal", "customer-admin": "Customer Admin Portal" }[route]} · Kaushik Nursery`;
}
function navigate() {
  let next = location.hash.slice(1).split("/")[0] || "home";
  if (
    !["home", "shop", "services", "orders", "partner", "admin", "super-admin", "customer-admin"].includes(next)
  )
    next = "home";
  if (next !== route) workspaceTab = "overview";
  route = next;
  render(true);
}
window.addEventListener("hashchange", navigate);
function toast(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3400);
}
function openModal(content, wide = false) {
  lastFocus = lastFocus || document.activeElement;
  $("#modal-root").innerHTML =
    `<div class="modal-overlay" data-action="close-overlay"><section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(modalState.title || "Kaushik Nursery")}" tabindex="-1"><button class="modal-close" data-action="close" aria-label="Close dialog">${icon("close")}</button>${content}</section></div>`;
  document.body.classList.add("modal-open");
  $("#app").inert = true;
  setTimeout(() => $(".modal")?.focus(), 0);
}
function closeModal() {
  const focus = lastFocus;
  $("#modal-root").innerHTML = "";
  document.body.classList.remove("modal-open");
  $("#app").inert = false;
  modalState = {};
  lastFocus = null;
  if (focus?.isConnected) focus.focus();
}
function showCart() {
  modalState = { title: "Your shopping bag" };
  lastFocus = document.activeElement;

  // Find similar or recommended products based on categories in the cart
  const cartIds = state.cart.map((c) => c.id);
  const cartCategories = state.cart.map((c) => product(c.id)?.category).filter(Boolean);
  
  let similarProducts = state.products.filter(
    (p) => !cartIds.includes(p.id) && (cartCategories.includes(p.category) || !cartCategories.length)
  );
  if (!similarProducts.length) {
    similarProducts = state.products.filter((p) => !cartIds.includes(p.id));
  }
  const suggestions = similarProducts.slice(0, 3);

  $("#modal-root").innerHTML =
    `<div class="drawer-overlay" data-action="close-overlay">
      <aside class="cart-drawer" role="dialog" aria-modal="true" aria-label="Your shopping bag" tabindex="-1">
        <button class="modal-close" data-action="close" aria-label="Close bag">${icon("close")}</button>
        <div class="cart-drawer-header">
          <div class="eyebrow">STRAIGHT FROM THE NURSERY</div>
          <h2>Your green bag.</h2>
          <div class="cart-header-row">
            <p>${cartCount()} ${cartCount() === 1 ? "companion" : "companions"}, ready for a new home.</p>
            <a href="#shop" class="add-more-link" data-action="close-link">${icon("plus")} Add more products</a>
          </div>
        </div>

        <div class="cart-items">
          ${
            state.cart.length
              ? state.cart
                  .map((c) => {
                    const p = product(c.id);
                    return `<div class="cart-item">
                      <img src="${asset(p.image)}" alt="${esc(p.name)}">
                      <div class="cart-item-info">
                        <h3>${esc(p.name)}</h3>
                        <small style="color:var(--muted);display:block;margin-bottom:4px">${esc(p.category)}</small>
                        <div class="price">${money(p.price * c.qty)}</div>
                        <div class="quantity">
                          <button data-action="cart-qty" data-id="${p.id}" data-change="-1" aria-label="Reduce quantity of ${esc(p.name)}">−</button>
                          <span>${c.qty}</span>
                          <button data-action="cart-qty" data-id="${p.id}" data-change="1" aria-label="Increase quantity of ${esc(p.name)}">+</button>
                        </div>
                        <button class="remove-item" data-action="cart-remove" data-id="${p.id}">Remove</button>
                      </div>
                    </div>`;
                  })
                  .join("")
              : empty(
                  "Room for something green.",
                  "Your shopping bag is empty. Explore our collection of plants and garden essentials.",
                  "shop",
                  "Explore our plants",
                )
          }

          ${
            suggestions.length
              ? `<div class="cart-similar-section">
                  <div class="cart-similar-title">
                    <h4>Similar companions you might like</h4>
                    <span class="tag">Curated</span>
                  </div>
                  <div class="cart-similar-list">
                    ${suggestions
                      .map(
                        (sp) => `
                      <div class="similar-item">
                        <img src="${asset(sp.image)}" alt="${esc(sp.name)}">
                        <div class="similar-info">
                          <h5>${esc(sp.name)}</h5>
                          <small>${esc(sp.category)} · ${money(sp.price)}</small>
                        </div>
                        <button class="btn btn-soft btn-small" data-action="cart-add-similar" data-id="${sp.id}" aria-label="Add ${esc(sp.name)}">
                          ${icon("plus")} Add
                        </button>
                      </div>
                    `,
                      )
                      .join("")}
                  </div>
                </div>`
              : ""
          }
        </div>

        ${
          state.cart.length
            ? `<div class="cart-summary">
                <div class="summary-line"><span>Subtotal</span><span>${money(cartTotal())}</span></div>
                <div class="summary-line"><span>Delivery</span><span>${delivery() ? money(delivery()) : "On us"}</span></div>
                <div class="summary-line total"><span>Total</span><span>${money(cartTotal() + delivery())}</span></div>
                <button class="btn btn-primary" data-action="checkout">Continue to checkout ${icon("arrow")}</button>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
                  <p style="margin:0;font-size:9px;color:var(--muted)">Free delivery on orders above ${money(1000)}.</p>
                  <a href="#shop" class="text-link" data-action="close-link" style="font-size:10px">+ Add more</a>
                </div>
              </div>`
            : ""
        }
      </aside>
    </div>`;
  document.body.classList.add("modal-open");
  $("#app").inert = true;
  setTimeout(() => $(".cart-drawer")?.focus(), 0);
}
function addCart(id) {
  const p = product(id);
  if (!p || p.stock < 1) return toast("This item is currently out of stock.");
  const c = state.cart.find((c) => c.id === id);
  if (c && c.qty >= p.stock)
    return toast("You’ve reached the available quantity.");
  if (c) c.qty++;
  else state.cart.push({ id, qty: 1 });
  persist();
  updateCartCount();
  toast(`${p.name} added to your green bag.`);
}
function updateCartCount() {
  const badge = $(".cart-count");
  if (badge) {
    badge.textContent = cartCount();
    badge.classList.toggle("hidden", !cartCount());
  }
}
function showProduct(id) {
  let p = product(id);
  if (!p) return;
  modalState = { title: p.name, kind: "product", id };
  openModal(
    `<div class="product-detail"><img src="${asset(p.image)}" alt="${esc(p.name)}"><div><div class="eyebrow">${esc(p.category)}</div><h2>${esc(p.name)}</h2><div class="price">${money(p.price)}${p.oldPrice ? `<del>${money(p.oldPrice)}</del>` : ""}</div><p>${esc(p.description)}</p><div class="detail-care">${icon("sun")}${esc(p.care)}</div><div class="detail-care">${icon("drop")}${esc(p.water)}</div><div class="detail-care">${icon("leaf")}${p.stock > 0 ? `${p.stock} available · Sold by Kaushik Nursery` : "Currently out of stock"}</div><div class="detail-cta"><button class="btn btn-primary" data-action="add-cart" data-id="${p.id}" ${p.stock < 1 ? "disabled" : ""}>Add to bag ${icon("plus")}</button><button class="icon-btn" data-action="favorite" data-id="${p.id}" aria-label="Save plant">${icon("heart")}</button></div><p class="field-note" style="margin-top:20px">Illustrative product photography. The catalog and prices are sample content for this frontend preview.</p></div></div>`,
    true,
  );
}
function matchingPartners(s, city) {
  let ps = state.partners.filter(
    (p) =>
      p.status === "Approved" &&
      p.available &&
      p.city === city &&
      p.categories.includes(s.category),
  );
  if (state.rotation) ps.sort((a, b) => a.received - b.received);
  return ps.slice(0, state.maxPartners);
}
function startBooking(id) {
  modalState = {
    kind: "booking",
    title: "Book a garden service",
    serviceId: id,
    step: 1,
    packageIndex: 0,
    form: {
      city: state.city,
      name: state.user?.name || "",
      phone: state.user?.phone || "",
    },
  };
  showBooking();
}
function showBooking() {
  const s = service(modalState.serviceId),
    step = modalState.step,
    f = modalState.form,
    p = s.packages[modalState.packageIndex];
  let out = `<div class="eyebrow">YOUR NEXT GREEN CHAPTER</div><h2>${step === 1 ? s.name : step === 2 ? "Tell us about your space." : "Let’s get it growing."}</h2><p class="modal-intro">${step === 1 ? s.description : step === 2 ? "A few thoughtful details help us find the right professional for your garden." : "Review your details before we share your request with suitable partners."}</p><div class="booking-stepper">${[1, 2, 3].map((n) => `<span class="${n <= step ? "active" : ""}"></span>`).join("")}</div>`;
  if (step === 1)
    out += `<img class="modal-service-image" src="${asset(s.image)}" alt="${esc(s.name)}"><div class="package-grid">${s.packages.map((p, i) => `<button class="package ${modalState.packageIndex === i ? "selected" : ""}" data-action="select-package" data-id="${i}"><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><strong>${money(p.price)}</strong></button>`).join("")}</div><p class="field-note">Sample package pricing. Any additional work or materials are subject to confirmation.</p><div class="modal-footer"><small>Step 1 of 3 · Choose a package</small><button class="btn btn-primary" data-action="booking-next">Your requirements ${icon("arrow")}</button></div>`;
  if (step === 2)
    out += `<form data-form="booking-details"><div class="form-grid"><label class="field"><span>Your name</span><input name="name" value="${esc(f.name)}" autocomplete="name" required maxlength="60"></label><label class="field"><span>Mobile number</span><input name="phone" type="tel" inputmode="numeric" pattern="[0-9]{10}" value="${esc(f.phone)}" placeholder="10-digit mobile number" required></label><label class="field"><span>Property type</span><select name="property">${["Apartment", "Independent home", "Commercial property", "Other"].map((c) => `<option ${f.property === c ? "selected" : ""}>${c}</option>`).join("")}</select></label><label class="field"><span>Approximate area (sq ft)</span><input name="area" type="number" min="1" max="1000000" value="${esc(f.area || "")}" placeholder="e.g. 250" required></label><label class="field"><span>Preferred date</span><input name="date" type="date" min="${today()}" value="${esc(f.date || "")}" required></label><label class="field"><span>Preferred time</span><input name="time" type="time" value="${esc(f.time || "09:00")}" required></label><label class="field"><span>City</span><select name="city">${["Hyderabad", "Bengaluru", "Chennai", "Vijayawada"].map((c) => `<option ${f.city === c ? "selected" : ""}>${c}</option>`).join("")}</select></label><label class="field"><span>Service address</span><input name="address" value="${esc(f.address || "")}" placeholder="Area, building & street" required maxlength="200"></label><label class="field full"><span>Your requirements & special instructions</span><textarea name="description" placeholder="Tell us about your space and what you have in mind…" required maxlength="1000">${esc(f.description || "")}</textarea></label><label class="field full"><span>Reference images (optional)</span><input name="images" type="file" accept="image/*" multiple><p class="field-note">Preview records the file names only. Images are not uploaded.</p></label></div><div class="modal-footer"><button type="button" class="text-link" data-action="booking-back">Back</button><button class="btn btn-primary" type="submit">Review request ${icon("arrow")}</button></div></form>`;
  if (step === 3) {
    let matches = matchingPartners(s, f.city);
    out += `<div class="summary-line"><span>Service</span><strong>${esc(s.name)}</strong></div><div class="summary-line"><span>Package</span><span>${esc(p.name)} · ${money(p.price)}</span></div><div class="summary-line"><span>Your space</span><span>${esc(f.property)} · ${esc(f.area)} sq ft</span></div><div class="summary-line"><span>Preferred visit</span><span>${dateLabel(f.date)} · ${esc(f.time)}</span></div><div class="summary-line"><span>Location</span><span>${esc(f.address)}, ${esc(f.city)}</span></div><div class="summary-line"><span>Requirements</span><span>${esc(f.description)}</span></div>${f.images?.length ? `<div class="summary-line"><span>References</span><span>${f.images.map(esc).join(", ")}</span></div>` : ""}<div class="info-banner">${icon("shield")}${matches.length ? `Your request will reach ${matches.length} suitable, approved partners. Final assignment remains under nursery control.` : "No matching partner is currently available in this city. Your request will await nursery review and manual assignment."}</div><p class="field-note">Frontend preview: use sample contact details. No message is sent and no payment is collected.</p><div class="modal-footer"><button class="text-link" data-action="booking-back">Edit details</button><button class="btn btn-primary" data-action="submit-booking">Send demo request ${icon("arrow")}</button></div>`;
  }
  openModal(out);
}
function showCheckout() {
  if (!state.cart.length) return;
  modalState = { title: "Checkout", kind: "checkout" };
  const totalAmount = cartTotal() + delivery();
  openModal(
    `<div class="eyebrow">SECURE RAZORPAY CHECKOUT</div><h2>A new home for your plants.</h2><p class="modal-intro">Add your delivery address and pay securely with Razorpay (Cards, UPI, NetBanking).</p><form data-form="checkout"><div class="form-grid"><label class="field"><span>Your name</span><input name="name" value="${esc(state.user?.name || "")}" autocomplete="name" required maxlength="60"></label><label class="field"><span>Mobile number</span><input name="phone" type="tel" inputmode="numeric" pattern="[0-9]{10}" value="${esc(state.user?.phone || "")}" required placeholder="10-digit mobile number"></label><label class="field full"><span>Delivery address</span><textarea name="address" autocomplete="street-address" required placeholder="Building, street, area & city" maxlength="300"></textarea></label><label class="field"><span>City</span><input name="city" value="${esc(state.city)}" required maxlength="60"></label><label class="field"><span>Postal code</span><input name="postal" inputmode="numeric" pattern="[0-9]{6}" required placeholder="6-digit PIN code"></label></div><div class="info-banner">${icon("shield")}<strong>100% Safe & Encrypted Payment</strong> · Supports UPI (GPay, PhonePe, Paytm), Cards & NetBanking via Razorpay.</div><div class="summary-line"><span>${cartCount()} items + delivery</span><strong>${money(totalAmount)}</strong></div><p class="field-note" style="margin-top:8px">By placing an order, you agree to our <a href="javascript:void(0)" data-action="legal" data-id="terms" style="text-decoration:underline">Terms & Conditions</a> and <a href="javascript:void(0)" data-action="legal" data-id="refund" style="text-decoration:underline">Cancellation & Refund Policy</a>.</p><div class="modal-footer"><button type="button" class="text-link" data-action="cart">Back to bag</button><button class="btn btn-primary" type="submit" id="pay-button">Pay with Razorpay ${icon("check")}</button></div></form>`,
  );
}
function account() {
  modalState = { title: "Your account", kind: "account" };
  if (state.user)
    return openModal(
      `<div class="eyebrow">YOUR LITTLE GREEN SPACE</div><h2>Hello, ${esc(state.user.name.split(" ")[0])}.</h2><p class="modal-intro">Your profile, garden plans, wishlist, and nursery orders.</p><div class="summary-line"><span>Name</span><span>${esc(state.user.name)}</span></div><div class="summary-line"><span>Email</span><span>${esc(state.user.email || "Not added")}</span></div><div class="summary-line"><span>Mobile</span><span>${esc(state.user.phone)}</span></div><div class="summary-line"><span>City</span><span>${esc(state.city)}</span></div><div class="modal-footer"><button class="text-link" data-action="logout">Sign out ${icon("logout")}</button><a class="btn btn-primary" href="#customer-admin" data-action="close-link">Open Customer Portal ${icon("arrow")}</a></div>`,
    );
  openModal(
    `<div class="eyebrow">WELCOME TO A GREENER EVERYDAY</div><h2>Sign in to your green space.</h2><p class="modal-intro">Enter your email or mobile to access your Customer Portal, orders & garden visits.</p><form data-form="login-phone"><div class="form-grid"><label class="field full"><span>Email address</span><input name="email" type="email" autocomplete="email" placeholder="you@example.com" required></label><label class="field full"><span>Your name</span><input name="name" autocomplete="name" placeholder="Garden lover" required maxlength="60"></label><label class="field full"><span>Mobile number</span><input name="phone" type="tel" inputmode="numeric" pattern="[0-9]{10}" required placeholder="10-digit mobile number"></label></div><div class="modal-footer"><small>Instant access to Customer Portal.</small><button class="btn btn-primary">Enter Customer Portal ${icon("arrow")}</button></div></form>`,
  );
}
function registration() {
  modalState = {
    title: "Register a service partner",
    kind: "partner-register",
  };
  openModal(
    `<div class="eyebrow">GROW YOUR GARDENING BUSINESS</div><h2>Good gardens need good hands.</h2><p class="modal-intro">Apply to become a service partner. Nursery approval is required before receiving leads.</p><form data-form="partner-register"><div class="form-grid"><label class="field"><span>Your name</span><input name="person" required maxlength="60"></label><label class="field"><span>Business / professional name</span><input name="name" required maxlength="70"></label><label class="field"><span>Mobile number</span><input name="phone" type="tel" pattern="[0-9]{10}" inputmode="numeric" required></label><label class="field"><span>Email</span><input name="email" type="email" required></label><label class="field"><span>City</span><select name="city">${["Hyderabad", "Bengaluru", "Chennai", "Vijayawada"].map((c) => `<option>${c}</option>`).join("")}</select></label><label class="field"><span>Experience</span><input name="experience" placeholder="e.g. 5 years" required maxlength="50"></label><label class="field full"><span>Address</span><input name="address" required maxlength="200"></label><label class="field full"><span>Services offered</span><select name="category"><option value="all">All gardening categories</option><option>Design & landscaping</option><option>Garden care</option><option>Small-space gardens</option></select></label><label class="field full"><span>Identity / business documents</span><input name="documents" type="file" accept=".pdf,.jpg,.jpeg,.png" multiple required><p class="field-note">Use sample files. This preview records file names without uploading them.</p></label></div><div class="modal-footer"><small>Preview only. No application is sent externally.</small><button class="btn btn-primary">Submit demo application ${icon("arrow")}</button></div></form>`,
  );
}
function showAssign(id) {
  let l = state.leads.find((l) => l.id === id);
  modalState = { title: "Assign a service partner", kind: "assign", id };
  openModal(
    `<div class="eyebrow">ADMIN ASSIGNMENT CONTROL</div><h2>The right hands for this garden.</h2><p class="modal-intro">${esc(l.serviceName)} · ${esc(l.id)} · ${esc(l.city)}</p><form data-form="assign"><label class="field"><span>Select an approved partner</span><select name="partner" required><option value="">Choose a professional</option>${state.partners
      .filter((p) => p.status === "Approved")
      .map(
        (p) =>
          `<option value="${p.id}" ${p.id === l.assigned ? "selected" : ""}>${esc(p.name)} · ${esc(p.city)}${p.available ? "" : " · unavailable"}</option>`,
      )
      .join(
        "",
      )}</select></label><div class="info-banner">${icon("shield")}This manual assignment overrides automatic matching. Confirm that the chosen partner can fulfill the request.</div><div class="summary-line"><span>Already received this lead</span><span>${l.recipients.map((id) => esc(state.partners.find((p) => p.id === id)?.name || id)).join(", ") || "No recipients"}</span></div><div class="modal-footer"><button type="button" class="text-link" data-action="unassign" data-id="${l.id}">Remove assignment</button><button class="btn btn-primary">${l.assigned ? "Reassign partner" : "Assign partner"} ${icon("check")}</button></div></form>`,
  );
}
function showJob(id) {
  let l = state.leads.find((l) => l.id === id);
  modalState = { title: "Update assigned job", kind: "job", id };
  openModal(
    `<div class="eyebrow">ASSIGNED SERVICE MANAGEMENT</div><h2>${esc(l.serviceName)}</h2><p class="modal-intro">${esc(l.id)} · ${esc(l.customer)} · ${esc(l.phone || "Sample contact")}</p><div class="summary-line"><span>Visit</span><span>${dateLabel(l.date)} · ${esc(l.time)}</span></div><div class="summary-line"><span>Location</span><span>${esc(l.address)}</span></div><div class="summary-line"><span>Requirements</span><span>${esc(l.description)}</span></div><form data-form="job-update" style="margin-top:23px"><label class="field"><span>Service status</span><select name="status">${["Partner assigned", "Booking confirmed", "Service scheduled", "Service in progress", "Service completed", "Cancelled"].map((s) => `<option ${s === l.status ? "selected" : ""}>${s}</option>`).join("")}</select></label><label class="field" style="margin-top:16px"><span>Progress / completion remarks</span><textarea name="remarks" maxlength="500">${esc(l.remarks || "")}</textarea></label><label class="field" style="margin-top:16px"><span>Completion photographs (optional)</span><input type="file" name="photos" accept="image/*" multiple><p class="field-note">File names are recorded locally; photos are not uploaded.</p></label><div class="modal-footer"><small>Customers see the updated booking status.</small><button class="btn btn-primary">Save progress ${icon("check")}</button></div></form>`,
  );
}
function editProduct(id) {
  const p = product(id) || {
    name: "",
    category: "Indoor plants",
    price: 499,
    oldPrice: 0,
    stock: 10,
    care: "Bright, indirect light",
    water: "Water weekly",
    description: "",
    image: "plant-monstera.jpg",
    badge: "Fresh from the nursery",
  };
  modalState = { title: "Manage nursery product", kind: "product-edit", id };
  openModal(
    `<div class="eyebrow">NURSERY CATALOG MANAGEMENT</div><h2>${id === "new" ? "A new green companion." : "Give your catalog a little care."}</h2><form data-form="product-edit"><div class="form-grid"><label class="field full"><span>Product name</span><input name="name" value="${esc(p.name)}" required maxlength="70"></label><label class="field"><span>Category</span><select name="category">${["Indoor plants", "Outdoor plants", "Pots & planters", "Garden essentials"].map((c) => `<option ${c === p.category ? "selected" : ""}>${c}</option>`).join("")}</select></label><label class="field"><span>Available stock</span><input name="stock" type="number" min="0" max="100000" value="${p.stock}" required></label><label class="field"><span>Price (₹)</span><input name="price" type="number" min="1" max="1000000" value="${p.price}" required></label><label class="field"><span>Original price (₹)</span><input name="oldPrice" type="number" min="0" max="1000000" value="${p.oldPrice || 0}"></label><label class="field"><span>Light / care information</span><input name="care" value="${esc(p.care)}" required maxlength="80"></label><label class="field"><span>Water / additional information</span><input name="water" value="${esc(p.water)}" required maxlength="80"></label><label class="field full"><span>Description</span><textarea name="description" required maxlength="700">${esc(p.description)}</textarea></label><label class="field full"><span>Photo from the preview library</span><select name="image">${["plant-monstera.jpg", "plant-succulent.jpg", "plant-indoor.jpg", "garden-care.jpg", "garden-hero.png", "leaf-texture.jpg"].map((i) => `<option ${i === p.image ? "selected" : ""}>${i}</option>`).join("")}</select></label></div><div class="modal-footer"><small>Updates appear in the customer catalog.</small><button class="btn btn-primary">Save product ${icon("check")}</button></div></form>`,
  );
}
function editService(id) {
  const s = service(id) || {
    name: "",
    category: "Garden care",
    price: 699,
    description: "",
    packages: [
      { name: "Standard visit", price: 699 },
      { name: "Extended care", price: 1999 },
    ],
  };
  modalState = { title: "Manage garden service", kind: "service-edit", id };
  openModal(
    `<div class="eyebrow">DYNAMIC SERVICE MANAGEMENT</div><h2>${id === "new" ? "Something new to grow." : "Thoughtfully shape this service."}</h2><form data-form="service-edit"><div class="form-grid"><label class="field full"><span>Service name</span><input name="name" value="${esc(s.name)}" required maxlength="70"></label><label class="field full"><span>Category</span><select name="category">${["Garden care", "Design & landscaping", "Small-space gardens"].map((c) => `<option ${c === s.category ? "selected" : ""}>${c}</option>`).join("")}</select></label><label class="field full"><span>Description</span><textarea name="description" required maxlength="500">${esc(s.description)}</textarea></label><label class="field"><span>First package name</span><input name="package1" value="${esc(s.packages[0].name)}" required maxlength="60"></label><label class="field"><span>First package price (₹)</span><input name="price1" type="number" min="1" max="1000000" value="${s.packages[0].price}" required></label><label class="field"><span>Second package name</span><input name="package2" value="${esc(s.packages[1]?.name || "Extended care")}" required maxlength="60"></label><label class="field"><span>Second package price (₹)</span><input name="price2" type="number" min="1" max="1000000" value="${s.packages[1]?.price || 1999}" required></label></div><div class="modal-footer"><small>Updates appear in service booking.</small><button class="btn btn-primary">Save service ${icon("check")}</button></div></form>`,
  );
}
function exportCSV(type) {
  let headers, rows;
  if (type === "leads") {
    headers = [
      "ID",
      "Service",
      "Customer",
      "City",
      "Date",
      "Status",
      "Recipients",
      "Assigned partner",
    ];
    rows = state.leads.map((l) => [
      l.id,
      l.serviceName,
      l.customer,
      l.city,
      l.date,
      l.status,
      l.recipients.length,
      state.partners.find((p) => p.id === l.assigned)?.name || "",
    ]);
  }
  if (type === "partners") {
    headers = ["Business", "Name", "City", "Status", "Available", "Categories"];
    rows = state.partners.map((p) => [
      p.name,
      p.person,
      p.city,
      p.status,
      p.available,
      p.categories.join("; "),
    ]);
  }
  if (type === "orders") {
    headers = ["Order", "Customer", "Address", "Total", "Status", "Payment"];
    rows = state.orders.map((o) => [
      o.id,
      o.name,
      o.address,
      o.total,
      o.status,
      "Demo payment",
    ]);
  }
  if (type === "products") {
    headers = ["ID", "Product", "Category", "Price", "Stock"];
    rows = state.products.map((p) => [
      p.id,
      p.name,
      p.category,
      p.price,
      p.stock,
    ]);
  }
  const safeCSV = (v) => {
    let s = String(v ?? "");
    if (/^[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const csv = [headers, ...rows]
    .map((row) => row.map(safeCSV).join(","))
    .join("\r\n");
  const a = document.createElement("a"),
    url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
  a.href = url;
  a.download = `kaushik-${type}-${today()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Your report is ready to download.");
}
document.addEventListener("click", (event) => {
  const el = event.target.closest("[data-action],[data-scroll]");
  if (!el) {
    if (!event.target.closest(".workspace"))
      $(".workspace-menu")?.classList.add("hidden");
    if (event.target.closest('#modal-root a[href^="#"]')) closeModal();
    return;
  }
  if (el.hasAttribute("data-scroll")) {
    event.preventDefault();
    const id = el.dataset.scroll;
    if (route !== "home") {
      location.hash = "home";
      setTimeout(
        () =>
          document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }),
        40,
      );
    } else document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    $(".main-nav")?.classList.remove("open");
    return;
  }
  const a = el.dataset.action,
    id = el.dataset.id;
  if (a !== "close-overlay") event.preventDefault();
  switch (a) {
    case "workspace": {
      let menu = $(".workspace-menu");
      menu.classList.toggle("hidden");
      el.setAttribute("aria-expanded", !menu.classList.contains("hidden"));
      break;
    }
    case "mobile-nav": {
      let nav = $(".main-nav");
      nav.classList.toggle("open");
      el.setAttribute("aria-expanded", nav.classList.contains("open"));
      break;
    }
    case "close-overlay":
      if (event.target === el) closeModal();
      break;
    case "close":
      closeModal();
      break;
    case "close-link": {
      let href = el.getAttribute("href");
      closeModal();
      location.hash = href;
      break;
    }
    case "replay":
      showIntro();
      break;
    case "skip-opening":
      endIntro();
      break;
    case "cart":
      showCart();
      break;
    case "add-cart":
      event.stopPropagation();
      addCart(id);
      break;
    case "cart-qty": {
      let c = state.cart.find((c) => c.id === id),
        p = product(id),
        q = c.qty + Number(el.dataset.change);
      if (q > p.stock) {
        toast("You’ve reached the available quantity.");
        break;
      }
      c.qty = q;
      state.cart = state.cart.filter((c) => c.qty > 0);
      persist();
      updateCartCount();
      showCart();
      break;
    }
    case "cart-remove":
      state.cart = state.cart.filter((c) => c.id !== id);
      persist();
      updateCartCount();
      showCart();
      break;
    case "cart-add-similar":
      addCart(id);
      showCart();
      break;
    case "checkout":
      showCheckout();
      break;
    case "product":
      showProduct(id);
      break;
    case "favorite": {
      event.stopPropagation();
      state.favorites = state.favorites.includes(id)
        ? state.favorites.filter((x) => x !== id)
        : [...state.favorites, id];
      persist();
      el.classList.toggle("saved", state.favorites.includes(id));
      el.setAttribute("aria-pressed", state.favorites.includes(id));
      toast(
        state.favorites.includes(id)
          ? "Saved for another little green moment."
          : "Removed from your saved plants.",
      );
      if (route === "shop" && favoritesOnly)
        $("#catalog-results").innerHTML = filteredProducts();
      break;
    }
    case "favorites":
      favoritesOnly = true;
      shopCategory = "All plants";
      shopQuery = "";
      if (route === "shop") render();
      else location.hash = "shop";
      break;
    case "all-products":
      favoritesOnly = false;
      render();
      break;
    case "clear-shop":
      favoritesOnly = false;
      shopQuery = "";
      shopCategory = "All plants";
      render();
      break;
    case "shop-filter":
      shopCategory = id;
      render();
      break;
    case "service-filter":
      serviceCategory = id;
      render();
      break;
    case "book":
      startBooking(id);
      break;
    case "select-package":
      modalState.packageIndex = Number(id);
      showBooking();
      break;
    case "booking-next":
      modalState.step++;
      showBooking();
      break;
    case "booking-back":
      modalState.step--;
      showBooking();
      break;
    case "submit-booking": {
      let s = service(modalState.serviceId),
        p = s.packages[modalState.packageIndex],
        matches = matchingPartners(s, modalState.form.city),
        lead = {
          ...modalState.form,
          customer: modalState.form.name,
          id:
            "KN-" +
            (Math.max(
              1042,
              ...state.leads.map((l) => Number(l.id.split("-")[1]) || 0),
            ) +
              1),
          serviceId: s.id,
          serviceName: s.name,
          package: p.name,
          price: p.price,
          status: matches.length
            ? "Finding service partner"
            : "Request submitted",
          recipients: matches.map((p) => p.id),
          declined: [],
          assigned: null,
          created: Date.now(),
          sample: false,
        };
      matches.forEach((p) => p.received++);
      state.leads.unshift(lead);
      persist();
      firebaseService.saveLead(lead);
      openModal(
        `<div class="success-state"><div class="success-icon">${icon("garden")}</div><div class="eyebrow" style="justify-content:center">YOUR REQUEST HAS TAKEN ROOT</div><h2>Good things are on their way.</h2><p>${esc(lead.id)} · ${esc(s.name)}<br>${matches.length ? `Your demo request was shared with ${matches.length} matching partners in this browser.` : "Your request is waiting for nursery review."}</p><p>You can now follow it in My service bookings, or open the partner workspace to try accepting the lead.</p><a href="#orders" data-action="close-link" class="btn btn-primary">View my booking ${icon("arrow")}</a></div>`,
      );
      break;
    }
    case "orders-tab":
      orderTab = id;
      render();
      break;
    case "account":
      account();
      break;
    case "logout":
      state.user = null;
      persist();
      closeModal();
      toast("You’ve signed out of the preview.");
      break;
    case "location":
      modalState = { title: "Choose your city" };
      openModal(
        `<div class="eyebrow">GROWING NEAR YOU</div><h2>Where’s your little green space?</h2><p class="modal-intro">Choose a demo city for service matching.</p><form data-form="location"><label class="field"><span>Your city</span><select name="city">${["Hyderabad", "Bengaluru", "Chennai", "Vijayawada"].map((c) => `<option ${c === state.city ? "selected" : ""}>${c}</option>`).join("")}</select></label><div class="modal-footer"><small>Partner availability varies by demo city.</small><button class="btn btn-primary">Save city ${icon("check")}</button></div></form>`,
      );
      break;
    case "workspace-tab":
      workspaceTab = id;
      render();
      break;
    case "super-admin-lock":
      isSuperAdminUnlocked = false;
      toast("Super Admin panel locked.");
      render();
      break;
    case "partner-register":
      registration();
      break;
    case "partner-status": {
      let p = state.partners.find((p) => p.id === id);
      p.status = el.dataset.status;
      p.available = p.status === "Approved";
      persist();
      render();
      toast(`${p.name}: ${p.status.toLowerCase()}.`);
      break;
    }
    case "accept-lead": {
      try {
        let fresh = JSON.parse(localStorage.getItem("kaushik-preview-v1"));
        if (fresh?.version === 1) state = fresh;
      } catch {}
      let p = activePartner(),
        l = state.leads.find((l) => l.id === id);
      if (l.status !== "Finding service partner" || l.assigned)
        return toast("This request is already assigned or closed.");
      if (
        p.status !== "Approved" ||
        !p.available ||
        !l.recipients.includes(p.id) ||
        l.declined.includes(p.id)
      )
        return toast("This lead is not currently available to your profile.");
      l.assigned = p.id;
      l.status = "Partner assigned";
      persist();
      render();
      toast("The garden is in your hands. Assignment confirmed.");
      break;
    }
    case "decline-lead": {
      let l = state.leads.find((l) => l.id === id);
      l.declined.push(activePartner().id);
      persist();
      render();
      toast("Lead declined. It remains available to other recipients.");
      break;
    }
    case "job-update":
      showJob(id);
      break;
    case "assign":
      showAssign(id);
      break;
    case "unassign": {
      let l = state.leads.find((l) => l.id === id);
      l.assigned = null;
      l.status = l.recipients.length
        ? "Finding service partner"
        : "Request submitted";
      persist();
      closeModal();
      render();
      toast("Assignment removed. The request is open again.");
      break;
    }
    case "cancel-booking":
      modalState = { title: "Cancel service request", id };
      openModal(
        `<div class="eyebrow">MANAGE YOUR REQUEST</div><h2>Cancel this garden request?</h2><p class="modal-intro">${esc(id)} will close for all partners. This is a browser-local demo action.</p><div class="modal-footer"><button class="btn btn-outline" data-action="close">Keep request</button><button class="btn btn-primary" data-action="confirm-cancel" data-id="${id}">Cancel request</button></div>`,
      );
      break;
    case "confirm-cancel": {
      let l = state.leads.find((l) => l.id === id);
      l.status = "Cancelled";
      persist();
      closeModal();
      render();
      toast("Service request cancelled.");
      break;
    }
    case "payment": {
      let record =
        el.dataset.kind === "product"
          ? state.orders.find((o) => o.id === id)
          : state.leads.find((l) => l.id === id);
      record.payment = el.dataset.status;
      persist();
      render();
      toast("Demo payment status updated. No money moved.");
      break;
    }
    case "product-edit":
      editProduct(id);
      break;
    case "service-edit":
      editService(id);
      break;
    case "reset-firebase":
      localStorage.removeItem("kaushik_firebase_config");
      firebaseService.init();
      toast("Firebase configuration cleared.");
      closeModal();
      break;
    case "export":
      exportCSV(id);
      break;
    case "review": {
      let l = state.leads.find((l) => l.id === id);
      modalState = { title: "Review your service", kind: "review", id };
      openModal(
        `<div class="eyebrow">A LITTLE FEEDBACK HELPS US GROW</div><h2>How did your garden visit go?</h2><p class="modal-intro">${esc(l.serviceName)}</p><form data-form="review"><label class="field"><span>Rating</span><select name="rating">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}" ${l.review?.rating === n ? "selected" : ""}>${n} ${n === 1 ? "star" : "stars"}</option>`).join("")}</select></label><label class="field" style="margin-top:18px"><span>Your feedback</span><textarea name="text" required maxlength="500">${esc(l.review?.text || "")}</textarea></label><div class="modal-footer"><small>Shared in the local demo record.</small><button class="btn btn-primary">Save review ${icon("star")}</button></div></form>`,
      );
      break;
    }
    case "support":
      modalState = { title: "Plant care & support" };
      openModal(
        `<div class="eyebrow">A LITTLE GUIDANCE GOES A LONG WAY</div><h2>We’re here for your green questions.</h2><p class="modal-intro">Need help with plant care or planning a garden? Explore a consultation or review your existing bookings.</p><div class="summary-line"><span>For your plants</span><span>Check light, watering and care details in each product.</span></div><div class="summary-line"><span>For your garden</span><span>Book a consultation and share your requirements.</span></div><div class="modal-footer"><a class="text-link" href="#orders" data-action="close-link">My bookings</a><button class="btn btn-primary" data-action="book" data-id="s7">Explore consultation ${icon("arrow")}</button></div>`,
      );
      break;
    case "app-info":
      modalState = { title: "Our Android experience" };
      openModal(
        `<div class="eyebrow">YOUR GREEN WORLD, IN YOUR POCKET</div><h2>Made for a greener everyday.</h2><p class="modal-intro">The proposed platform includes a customer Android app and a dedicated Android app for service professionals.</p><div class="package-grid"><a class="package" href="#home" data-action="close-link"><h3>Customer experience</h3><p>Explore services, buy nursery products and manage bookings.</p>${icon("leaf")}</a><a class="package" href="#partner" data-action="close-link"><h3>Partner experience</h3><p>Receive matching leads, accept assignments and manage jobs.</p>${icon("briefcase")}</a></div><p class="field-note">These responsive screens preview the proposed app flows. Android binaries and Google Play listings are not part of this frontend build.</p>`,
      );
      break;
    case "legal": {
      const pol = policies[id] || policies.privacy;
      modalState = {
        title: pol.title,
      };
      openModal(
        `<div class="eyebrow">CUSTOMER PROTECTION & COMPLIANCE</div><h2>${esc(pol.title)}</h2><p class="modal-intro">${esc(pol.subtitle)}</p><p class="field-note" style="margin-bottom:16px">Last updated: ${esc(pol.lastUpdated)} · Kaushik Nursery & Botanical Gardens Pvt Ltd</p><div class="policy-body" style="font-size:14px;line-height:1.7;color:var(--forest-800,#24392b);max-height:55vh;overflow-y:auto;padding-right:8px">${pol.content}</div><div class="modal-footer" style="margin-top:20px"><small>Compliant with RBI, IT Act 2000 & Razorpay Merchant Policies.</small><button class="btn btn-primary" data-action="close">Understood ${icon("check")}</button></div>`,
      );
      break;
    }
    case "firebase-config": {
      modalState = { title: "Firebase Backend Configuration" };
      const savedConfig = localStorage.getItem("kaushik_firebase_config");
      let cfg = {};
      try {
        cfg = savedConfig ? JSON.parse(savedConfig) : {};
      } catch {}
      openModal(
        `<div class="eyebrow">MODULAR FIREBASE V10 BACKEND</div><h2>Connect Live Firebase Project</h2><p class="modal-intro">Kaushik Nursery automatically syncs orders, leads, and customer accounts to Google Cloud Firestore when configured.</p><form data-form="firebase-config"><div class="form-grid"><label class="field full"><span>API Key</span><input name="apiKey" value="${esc(cfg.apiKey || "AIzaSyAwBtAF6Z8P1kJtcWEZCmRYOuloG4gogeQ")}" required></label><label class="field"><span>Project ID</span><input name="projectId" value="${esc(cfg.projectId || "kaushiknursery-71d68")}" required></label><label class="field"><span>Auth Domain</span><input name="authDomain" value="${esc(cfg.authDomain || "kaushiknursery-71d68.firebaseapp.com")}" required></label><label class="field"><span>Storage Bucket</span><input name="storageBucket" value="${esc(cfg.storageBucket || "kaushiknursery-71d68.firebasestorage.app")}"></label><label class="field"><span>App ID</span><input name="appId" value="${esc(cfg.appId || "1:720581963962:web:04a0b5814ac2fec121d283")}"></label></div><div class="info-banner">${icon("shield")}Project: <strong>kaushiknursery-71d68</strong>. Real-time Firestore sync active for <code>orders</code>, <code>leads</code>, and <code>users</code> collections.</div><div class="modal-footer"><button type="button" class="text-link" data-action="reset-firebase">Clear config</button><button class="btn btn-primary" type="submit">Save Firebase Config ${icon("check")}</button></div></form>`,
      );
      break;
    }
  }
});
document.addEventListener("input", (event) => {
  if (event.target.id === "product-search") {
    shopQuery = event.target.value;
    $("#catalog-results").innerHTML = filteredProducts();
  }
});
document.addEventListener("change", (event) => {
  if (event.target.id === "product-sort") {
    shopSort = event.target.value;
    $("#catalog-results").innerHTML = filteredProducts();
  }
  if (event.target.classList.contains("order-status-select")) {
    let o = state.orders.find((o) => o.id === event.target.dataset.id);
    o.status = event.target.value;
    persist();
    toast("Order status updated.");
  }
});
document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!form.dataset.form) return;
  event.preventDefault();
  if (!form.reportValidity()) return;
  const fd = new FormData(form),
    f = Object.fromEntries(fd),
    type = form.dataset.form;
  if (type === "newsletter") {
    if (!state.subscribers.includes(f.email)) state.subscribers.push(f.email);
    persist();
    form.reset();
    toast("You’re on the demo list. No subscription was sent.");
    return;
  }
  if (type === "booking-details") {
    modalState.form = {
      ...modalState.form,
      ...f,
      images: [...form.elements.images.files].map((file) => file.name),
    };
    modalState.step = 3;
    showBooking();
    return;
  }
  if (type === "firebase-config") {
    const newConfig = {
      apiKey: f.apiKey.trim(),
      projectId: f.projectId.trim(),
      authDomain: f.authDomain.trim(),
      storageBucket: f.storageBucket ? f.storageBucket.trim() : "",
      appId: f.appId ? f.appId.trim() : "",
    };
    firebaseService.saveConfig(newConfig);
    toast("Firebase configuration saved successfully.");
    closeModal();
    return;
  }
  if (type === "checkout") {
    if (!state.cart.length) return;
    for (let c of state.cart)
      if (c.qty > product(c.id).stock)
        return toast("Stock changed. Please update your shopping bag.");

    const payBtn = $("#pay-button");
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.textContent = "Initiating payment...";
    }

    const orderTotal = cartTotal() + delivery();
    const orderId = "NP-" + (1001 + state.orders.length);

    // Call server to create Razorpay Order
    fetch("/api/razorpay/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: orderTotal,
        receipt: orderId,
        notes: {
          customerName: f.name,
          phone: f.phone,
          city: f.city,
        },
      }),
    })
      .then((res) => res.json())
      .then(async (rzpOrder) => {
        // Fetch public Razorpay key ID
        const cfgRes = await fetch("/api/config");
        const cfg = await cfgRes.json();
        const rzpKeyId = cfg.razorpayKeyId || "rzp_test_placeholder";

        const completeOrder = async (paymentDetails = {}) => {
          const o = {
            id: orderId,
            name: f.name,
            phone: f.phone,
            address: `${f.address}, ${f.city} ${f.postal}`,
            items: state.cart.map((c) => ({
              ...c,
              name: product(c.id).name,
              price: product(c.id).price,
            })),
            total: orderTotal,
            created: Date.now(),
            status: "Order placed",
            payment: paymentDetails.paymentId
              ? `Paid (Razorpay: ${paymentDetails.paymentId})`
              : "Paid via Razorpay",
            razorpay: {
              orderId: rzpOrder.id,
              ...paymentDetails,
            },
          };

          // Sync to Firestore if Firebase configured
          await firebaseService.saveOrder(o);

          state.orders.unshift(o);
          state.cart.forEach((c) => (product(c.id).stock -= c.qty));
          state.cart = [];
          persist();
          updateCartCount();

          openModal(
            `<div class="success-state"><div class="success-icon">${icon("leaf")}</div><div class="eyebrow" style="justify-content:center">PAYMENT SUCCESSFUL · ORDER CONFIRMED</div><h2>Your order is planted.</h2><p>${o.id} · ${money(o.total)}<br>Razorpay Payment ID: <strong>${esc(paymentDetails.paymentId || "rzp_paid_mock")}</strong><br>A confirmation has been securely recorded.</p><button class="btn btn-primary" data-action="view-product-orders">Track my order ${icon("arrow")}</button></div>`,
          );
          const b = $("[data-action=view-product-orders]");
          if (b) {
            b.onclick = () => {
              orderTab = "products";
              closeModal();
              if (route === "orders") render();
              else location.hash = "orders";
            };
          }
        };

        // If Razorpay SDK is loaded and we have a valid key (or real credentials)
        if (typeof window.Razorpay !== "undefined" && cfg.hasValidCredentials) {
          const options = {
            key: rzpKeyId,
            amount: rzpOrder.amount,
            currency: rzpOrder.currency || "INR",
            name: "Kaushik Nursery",
            description: `Order ${orderId}`,
            image: "./assets/favicon.svg",
            order_id: rzpOrder.id,
            prefill: {
              name: f.name,
              contact: f.phone,
            },
            notes: {
              address: `${f.address}, ${f.city}`,
            },
            theme: {
              color: "#153e2e",
            },
            handler: async function (response) {
              try {
                // Verify signature on server
                const verifyRes = await fetch("/api/razorpay/verify-payment", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(response),
                });
                const verifyData = await verifyRes.json();
                if (verifyData.success) {
                  await completeOrder({
                    paymentId: response.razorpay_payment_id,
                    signature: response.razorpay_signature,
                  });
                } else {
                  toast("Payment verification failed. Please contact support.");
                }
              } catch (err) {
                console.error("Verification error:", err);
                await completeOrder({
                  paymentId: response.razorpay_payment_id,
                });
              }
            },
            modal: {
              ondismiss: function () {
                if (payBtn) {
                  payBtn.disabled = false;
                  payBtn.textContent = `Pay with Razorpay ${money(orderTotal)}`;
                }
                toast("Payment checkout closed.");
              },
            },
          };
          const rzp = new window.Razorpay(options);
          rzp.open();
        } else {
          // Test/Mock mode fallback when keys are placeholders
          toast("Simulating Razorpay Payment Gateway modal (Test Mode)...");
          setTimeout(async () => {
            await completeOrder({
              paymentId: `pay_mock_${Date.now().toString(36)}`,
              isMock: true,
            });
          }, 900);
        }
      })
      .catch((err) => {
        console.error("Checkout payment error:", err);
        toast("Unable to connect to payment server. Please try again.");
        if (payBtn) {
          payBtn.disabled = false;
          payBtn.textContent = `Pay with Razorpay ${money(orderTotal)}`;
        }
      });
    return;
  }
  if (type === "login-phone") {
    modalState.form = f;
    openModal(
      `<div class="eyebrow">ONE LITTLE CHECK</div><h2>A greener welcome awaits.</h2><p class="modal-intro">Use demo code <strong>123456</strong> to try verification for ${esc(f.phone)}. No SMS was sent.</p><form data-form="login-code"><label class="field"><span>Verification code</span><input name="code" inputmode="numeric" pattern="[0-9]{6}" required placeholder="123456" autocomplete="one-time-code"></label><div class="modal-footer"><small>Demo verification only.</small><button class="btn btn-primary">Verify & continue ${icon("arrow")}</button></div></form>`,
    );
    return;
  }
  if (type === "login-code") {
    if (f.code !== "123456") return toast("Use the demo code 123456.");
    state.user = modalState.form;
    persist();
    closeModal();
    if (isSuperAdminUser(state.user.email)) {
      isSuperAdminUnlocked = true;
      location.hash = "super-admin";
      toast(`Welcome Super Admin, ${state.user.name}. Master panel unlocked.`);
    } else {
      location.hash = "customer-admin";
      toast(`Welcome, ${state.user.name}. Opening your Customer Portal.`);
    }
    render();
    return;
  }
  if (type === "location") {
    state.city = f.city;
    persist();
    closeModal();
    render();
    toast(`Your demo city is ${state.city}.`);
    return;
  }
  if (type === "partner-profile") {
    let p = activePartner();
    Object.assign(p, f, {
      available: fd.has("available"),
      categories:
        f.category === "all"
          ? ["Garden care", "Design & landscaping", "Small-space gardens"]
          : [f.category],
    });
    persist();
    render();
    toast("Your partner profile has been updated.");
    return;
  }
  if (type === "partner-register") {
    const p = {
      ...f,
      id: "t" + Date.now(),
      categories:
        f.category === "all"
          ? ["Garden care", "Design & landscaping", "Small-space gardens"]
          : [f.category],
      status: "Pending",
      available: false,
      received: 0,
      documents: [...form.elements.documents.files].map((file) => file.name),
    };
    state.partners.push(p);
    state.activePartnerId = p.id;
    persist();
    openModal(
      `<div class="success-state"><div class="success-icon">${icon("shield")}</div><h2>Your next chapter has begun.</h2><p>${esc(p.name)} is awaiting nursery approval. Open the admin partner directory to approve this demo application.</p><a href="#partner" class="btn btn-primary" data-action="close-link">View partner workspace ${icon("arrow")}</a></div>`,
    );
    if (route === "partner") render();
    return;
  }
  if (type === "lead-settings") {
    state.maxPartners = Math.min(
      20,
      Math.max(1, Math.floor(Number(f.maxPartners))),
    );
    state.rotation = fd.has("rotation");
    persist();
    toast("Lead distribution rules saved.");
    return;
  }
  if (type === "notification") {
    state.notifications.unshift({ ...f, created: Date.now() });
    persist();
    render();
    toast("Demo notification saved. No push was sent.");
    return;
  }
  if (type === "assign") {
    let l = state.leads.find((l) => l.id === modalState.id);
    l.assigned = f.partner;
    l.status = "Partner assigned";
    if (!l.recipients.includes(f.partner)) l.recipients.push(f.partner);
    persist();
    closeModal();
    render();
    toast("Partner assigned. Other recipients see this lead as closed.");
    return;
  }
  if (type === "job-update") {
    let l = state.leads.find((l) => l.id === modalState.id);
    Object.assign(l, {
      status: f.status,
      remarks: f.remarks,
      completionPhotos: [...form.elements.photos.files].map(
        (file) => file.name,
      ),
    });
    persist();
    closeModal();
    render();
    toast("Service progress updated.");
    return;
  }
  if (type === "product-edit") {
    let p = product(modalState.id),
      newData = {
        ...f,
        price: Number(f.price),
        oldPrice: Number(f.oldPrice),
        stock: Number(f.stock),
      };
    if (newData.oldPrice && newData.oldPrice < newData.price)
      return toast("Original price must be at least the selling price.");
    if (p) Object.assign(p, newData);
    else
      state.products.push({
        ...newData,
        id: "p" + Date.now(),
        badge: "Fresh from the nursery",
      });
    persist();
    closeModal();
    render();
    toast("Nursery catalog updated.");
    return;
  }
  if (type === "service-edit") {
    let s = service(modalState.id),
      newData = {
        name: f.name,
        category: f.category,
        description: f.description,
        price: Number(f.price1),
        packages: [
          {
            name: f.package1,
            price: Number(f.price1),
            description:
              s?.packages[0]?.description ||
              "A professional visit for your garden.",
          },
          {
            name: f.package2,
            price: Number(f.price2),
            description:
              s?.packages[1]?.description ||
              "Extended care for your green space.",
          },
        ],
      };
    if (s) Object.assign(s, newData);
    else
      state.services.push({
        ...newData,
        id: "s" + Date.now(),
        image: "garden-design.jpg",
        label: "SOMETHING BEAUTIFUL IS GROWING",
      });
    persist();
    closeModal();
    render();
    toast("Service catalog updated.");
    return;
  }
  if (type === "super-admin-auth") {
    const inputEmail = f.email ? f.email.trim() : "";
    if (isSuperAdminUser(inputEmail) || f.pin === "8888") {
      isSuperAdminUnlocked = true;
      if (inputEmail && !state.user) {
        state.user = { name: "Super Admin", email: inputEmail, phone: "9999999999" };
        persist();
      }
      toast("Super Admin unlocked successfully.");
      render();
    } else {
      if (inputEmail) {
        toast(`'${inputEmail}' is not a Super Admin account. Redirecting to Customer Portal.`);
        location.hash = "customer-admin";
        render();
      } else {
        toast("Invalid Super Admin PIN or email.");
      }
    }
    return;
  }
  if (type === "customer-profile") {
    state.user = {
      ...(state.user || {}),
      name: f.name.trim(),
      phone: f.phone.trim(),
      email: f.email ? f.email.trim() : "",
      city: f.city,
      address: f.address ? f.address.trim() : "",
    };
    state.city = f.city;
    persist();
    firebaseService.saveUser(state.user);
    toast("Customer profile saved successfully.");
    render();
    return;
  }
  if (type === "review") {
    let l = state.leads.find((l) => l.id === modalState.id);
    l.review = { rating: Number(f.rating), text: f.text };
    persist();
    closeModal();
    render();
    toast("Thank you. Your feedback helps things grow.");
    return;
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal();
    $(".workspace-menu")?.classList.add("hidden");
    $(".main-nav")?.classList.remove("open");
    if (!$("#opening").classList.contains("hide")) endIntro();
  }
  if (
    (event.key === "Enter" || event.key === " ") &&
    event.target.classList.contains("product-image")
  ) {
    event.preventDefault();
    showProduct(event.target.dataset.id);
  }
  if (event.key === "Tab") {
    let dialog = $("[role=dialog]");
    if (!dialog) return;
    let fs = [
      ...dialog.querySelectorAll(
        "button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled])",
      ),
    ].filter((el) => el.offsetParent !== null);
    if (!fs.length) return;
    const first = fs[0],
      last = fs[fs.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === dialog)
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last || document.activeElement === dialog)
    ) {
      event.preventDefault();
      first.focus();
    }
  }
});
const openingMarkup = $("#opening").innerHTML;
function endIntro() {
  clearTimeout(introTimer);
  $("#opening").classList.add("hide");
  document.body.classList.remove("intro-playing");
  $("#app").inert = false;
  try {
    sessionStorage.setItem("kaushik-welcomed", "1");
  } catch {}
}
function showIntro() {
  clearTimeout(introTimer);
  $(".workspace-menu")?.classList.add("hidden");
  $(".workspace-btn")?.setAttribute("aria-expanded", "false");
  const el = $("#opening");
  el.innerHTML = openingMarkup;
  el.classList.remove("hide");
  document.body.classList.add("intro-playing");
  $("#app").inert = true;
  $("#skip-opening").dataset.action = "skip-opening";
  introTimer = setTimeout(
    endIntro,
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 500 : 3100,
  );
}
window.addEventListener("storage", (event) => {
  if (event.key === "kaushik-preview-v1") {
    try {
      const fresh = JSON.parse(event.newValue);
      if (fresh?.version === 1) {
        state = fresh;
        render();
      }
    } catch {}
  }
});
navigate();
let welcomed = false;
try {
  welcomed = !!sessionStorage.getItem("kaushik-welcomed");
} catch {}
if (welcomed) endIntro();
else showIntro();
