import {
  mountStorefrontInteractions,
  closeMobileNavigation,
} from "./storefront-interactions.js";
import {
  bannerEditor,
  changeBannerDraft,
  saveBannerDraft,
} from "./banner-admin.js";
import { policies } from "./policies.js";
import { api } from "./api.js";
import { installLiveController } from "./live-controller.js";
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
const asset = (n) => (n?.startsWith("/api/") ? n : `./assets/${n}`);
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
let preferences = {};
try {
  preferences =
    JSON.parse(localStorage.getItem("kaushik-local-preferences-v2")) || {};
} catch {}
let state = {
  products: [],
  services: [],
  categories: [],
  serviceCategories: [],
  partners: [],
  leads: [],
  orders: [],
  users: [],
  payments: [],
  cart: [],
  favorites: [],
  notifications: [],
  user: null,
  city: preferences.city || "Hyderabad",
  maxPartners: 6,
  rotation: true,
  paymentMode: "disabled",
  cursors: {},
  stats: {},
  catalogResults: null,
};
state.cart = Array.isArray(preferences.cart)
  ? preferences.cart
      .filter(
        (c) =>
          typeof c.id === "string" &&
          Number.isInteger(c.qty) &&
          c.qty > 0 &&
          c.qty <= 99,
      )
      .slice(0, 50)
  : [];
state.favorites = Array.isArray(preferences.favorites)
  ? preferences.favorites.filter((x) => typeof x === "string").slice(0, 500)
  : [];
let backendError = "",
  catalogSignature = "",
  catalogTimer;
const persist = () => {
  try {
    localStorage.setItem(
      "kaushik-local-preferences-v2",
      JSON.stringify({
        city: state.city,
        cart: state.user ? [] : state.cart,
        favorites: state.user ? [] : state.favorites,
      }),
    );
  } catch {}
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
  observer,
  disposeStorefront = () => {};

const product = (id) =>
  state.products.find((p) => p.id === id) ||
  state.catalogResults?.find((p) => p.id === id) ||
  state.wishlistProducts?.find((p) => p.id === id);
const service = (id) => state.services.find((s) => s.id === id);
const cartTotal = () =>
  state.cart.reduce((sum, c) => sum + (product(c.id)?.price || 0) * c.qty, 0);
const cartCount = () => state.cart.reduce((sum, c) => sum + c.qty, 0);
const delivery = () => (cartTotal() >= 1000 ? 0 : 99);
const cartUnavailable = () =>
  state.cart.some((c) => {
    const p = product(c.id);
    return !p || p.active === false || p.stock < c.qty;
  });
const tag = (text) =>
  `<span class="tag ${/Pending|Finding|Request/.test(text) ? "orange" : /Cancel|Reject|Suspend/.test(text) ? "gray" : ""}">${esc(text)}</span>`;
const brand = () =>
  `<a href="#home" class="brand" aria-label="Kaushik Nursery home"><svg class="brand-icon" viewBox="0 0 40 42" fill="none"><path d="M8 30C4 14 19 4 34 5c1 14-10 27-26 25Z" fill="#d1dec1"/><path d="M7 36C11 25 18 17 28 10M13 25l1-12m5 5 12 1" stroke="#315239" stroke-width="1.6" stroke-linecap="round"/></svg><span class="brand-words">kaushik<span style="font-weight:400">.</span><small>NURSERY & GARDENS</small></span></a>`;
function header() {
  const collections = state.categories.slice(0, 5);
  return `<div class="store-chrome">${state.paymentMode === "test" ? '<div class="environment-notice">Test environment · No money is collected</div>' : ""}<a class="skip-content" href="#main-content">Skip to content</a>
    <div class="store-announcement"><div class="container announcement-inner"><span>${icon("leaf")} A little greener. A lot better.</span><span class="announcement-offer">From our nursery to your home · Free delivery on orders ₹1,000+</span><div><button data-action="support">Help & care</button><a href="#orders">Track your order ${icon("arrow")}</a></div></div></div>
    <header class="site-header"><div class="container header-inner">${brand()}
      <form class="header-search" data-form="catalog-search" role="search"><label class="hidden" for="header-query">Search nursery products</label><input id="header-query" name="query" type="search" aria-label="Search nursery products" value="${route === "shop" ? esc(shopQuery) : ""}" placeholder="Find your next plant, pot or garden essential…" autocomplete="off"><button aria-label="Search products" type="submit">${icon("search")}</button></form>
      <div class="header-actions"><button class="location-btn" data-action="location" aria-label="Change city">${icon("pin")}<span><small>Your green space</small>${esc(state.city)} ${icon("down")}</span></button><button class="icon-btn" data-action="notifications" aria-label="Your notifications">${icon("bell")}</button><button class="icon-btn" data-action="account" aria-label="Your account">${icon("user")}</button><button class="icon-btn" data-action="favorites" aria-label="Saved plants">${icon("heart")}</button><button class="icon-btn" data-action="cart" aria-label="Open shopping bag">${icon("bag")}<span class="cart-count ${cartCount() ? "" : "hidden"}">${cartCount()}</span></button><button class="icon-btn mobile-menu" data-action="mobile-nav" aria-label="Open navigation" aria-controls="mobile-navigation" aria-expanded="false"><span class="menu-toggle-lines" aria-hidden="true"><span></span><span></span><span></span></span></button></div>
    </div><div class="navigation-border"><nav class="container main-nav" aria-label="Main navigation"><a href="#home" class="${route === "home" ? "active" : ""}">Home</a><a href="#services" class="nav-services ${route === "services" ? "active" : ""}">${icon("garden")} Garden services</a><button data-action="browse-category" data-id="All plants" class="${route === "shop" && shopCategory === "All plants" ? "active" : ""}">All products ${icon("down")}</button>${collections.map((c) => `<button data-action="browse-category" data-id="${esc(c)}" class="${route === "shop" && shopCategory === c ? "active" : ""}">${esc(c)}</button>`).join("")}</nav></div></header><button type="button" class="mobile-nav-scrim" aria-label="Dismiss navigation" hidden></button><nav id="mobile-navigation" class="mobile-nav-panel" aria-label="Mobile navigation" hidden inert><div class="mobile-nav-heading"><span>Explore the nursery</span><button class="icon-btn" data-action="mobile-nav-close" aria-label="Close mobile menu">${icon("close")}</button></div><a class="mobile-nav-item" href="#home">${icon("leaf")} Home ${icon("arrow")}</a><a class="mobile-nav-item" href="#services">${icon("garden")} Garden services ${icon("arrow")}</a><button class="mobile-nav-item" data-action="browse-category" data-id="All plants">${icon("bag")} All products ${icon("arrow")}</button><div class="mobile-nav-categories">${state.categories.map((c) => `<button class="mobile-nav-item" data-action="browse-category" data-id="${esc(c)}">${esc(c)} ${icon("arrow")}</button>`).join("")}</div><div class="mobile-nav-accounts"><a class="mobile-nav-item" href="#customer-admin">${icon("user")} Your account ${icon("arrow")}</a><a class="mobile-nav-item" href="#orders">${icon("truck")} Orders & bookings ${icon("arrow")}</a><button class="mobile-nav-item" data-action="location">${icon("pin")} ${esc(state.city)} · Change city ${icon("arrow")}</button></div></nav></div>`;
}
function footer() {
  return `<footer class="site-footer"><div class="container"><div class="footer-grid"><div class="footer-brand">${brand()}<p>A plant for every corner.<br>A little care for every garden.</p><button class="footer-support" data-action="support">${icon("leaf")} Let’s help your garden grow ${icon("arrow")}</button></div><div class="footer-col"><h4>Explore the nursery</h4><a href="#services">Garden services</a><button data-action="browse-category" data-id="All plants">Buy our products</button><button data-action="browse-category" data-id="Indoor plants">Indoor plants</button><button data-action="browse-category" data-id="Pots & planters">Pots & planters</button><button data-action="support">Plant care & support</button></div><div class="footer-col"><h4>Your green space</h4><a href="#orders">Orders & service bookings</a><button data-action="account">Your account</button><a href="#customer-admin">Customer portal</a><a href="#partner">Service partner portal</a><button data-action="app-info">Our Android apps</button></div><div class="footer-col"><h4>Here to help</h4><button data-action="legal" data-id="contact">Contact us</button><button data-action="legal" data-id="shipping">Shipping & delivery</button><button data-action="legal" data-id="refund">Cancellations & returns</button><button data-action="legal" data-id="privacy">Privacy policy</button><button data-action="legal" data-id="terms">Terms & conditions</button></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} Kaushik Nursery. Good things take root.</span><div><a href="#super-admin">Admin workspace</a><button data-action="replay">${icon("replay")}A moment of green</button></div></div></div></footer>`;
}
function productCard(p) {
  const discount =
    p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  return `<article class="product-card"><div class="product-image"><button class="product-photo-button" data-action="product" data-id="${p.id}" aria-label="View ${esc(p.name)}"><img src="${asset(p.image)}" alt="${esc(p.name)}" loading="lazy"></button>${discount ? `<span class="product-badge">${discount}% off</span>` : ""}<button class="favorite-btn ${state.favorites.includes(p.id) ? "saved" : ""}" data-action="favorite" data-id="${p.id}" aria-label="${state.favorites.includes(p.id) ? "Unsave" : "Save"} ${esc(p.name)}" aria-pressed="${state.favorites.includes(p.id)}">${icon("heart")}</button></div><div class="product-info"><small>${esc(p.category)}</small><h3><a href="#shop" data-action="product" data-id="${p.id}">${esc(p.name)}</a></h3><div class="product-care">${icon("sun")}${esc(p.care)}</div><div class="product-purchase"><div class="price">${money(p.price)} ${p.oldPrice ? `<del>${money(p.oldPrice)}</del>` : ""}</div><button class="product-add" data-action="add-cart" data-id="${p.id}" aria-label="Add ${esc(p.name)} to bag" ${p.active === false || p.stock < 1 ? "disabled" : ""}>${p.active === false || p.stock < 1 ? "Sold out" : "Add"} ${icon("plus")}</button></div></div></article>`;
}
function serviceCard(s) {
  return `<button class="service-card" data-action="book" data-id="${s.id}"><div class="service-photo"><img src="${asset(s.image)}" alt="${esc(s.name)}" loading="lazy"><span class="photo-label">${esc(s.label)}</span></div><div class="service-card-content"><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p><div class="card-bottom"><span>From <strong>${money(s.price)}</strong></span><span class="circle-arrow">${icon("up")}</span></div></div></button>`;
}
function heroBanner() {
  const content = state.hero || {
    autoplay: true,
    intervalSeconds: 6,
    slides: [
      {
        id: "nursery-garden",
        image: "garden-hero.png",
        alt: "Sunlit nursery garden",
        link: "#services",
      },
    ],
  };
  const slides = content.slides;
  return `<div class="welcome-image hero-carousel" data-hero-carousel data-autoplay="${content.autoplay}" data-interval="${content.intervalSeconds}" role="region" aria-roledescription="carousel" aria-label="Nursery banners"><h1 class="mobile-hero-title">Kaushik Nursery plants and garden services</h1>${slides.map((s, i) => `<a class="hero-slide" data-hero-slide href="${esc(s.link)}" aria-label="${esc(s.alt)}" aria-hidden="${i !== 0}" ${i ? "hidden inert" : ""}><picture>${s.mobileImage ? `<source media="(max-width: 900px)" srcset="${asset(s.mobileImage)}">` : ""}<img src="${asset(s.image)}" alt="${esc(s.alt)}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} draggable="false"></picture></a>`).join("")}${slides.length > 1 ? `<div class="hero-controls"><button type="button" class="hero-arrow" data-hero-direction="-1" aria-label="Previous banner">${icon("arrow")}</button><div class="hero-dots" role="group" aria-label="Choose banner">${slides.map((s, i) => `<button type="button" data-hero-index="${i}" aria-label="Show banner ${i + 1}" aria-pressed="${i === 0}"></button>`).join("")}</div><button type="button" class="hero-pause" data-hero-pause aria-label="${content.autoplay ? "Pause" : "Play"} banner rotation" aria-pressed="${!content.autoplay}"><span aria-hidden="true"></span></button><button type="button" class="hero-arrow" data-hero-direction="1" aria-label="Next banner">${icon("arrow")}</button></div>` : ""}</div>`;
}
function home() {
  const categories = [
    [
      "Garden design",
      "Thoughtful outdoor spaces",
      "garden-design.jpg",
      "service",
      "s1",
    ],
    [
      "Garden care",
      "A little expert attention",
      "garden-care.jpg",
      "service",
      "s2",
    ],
    [
      "Terrace gardens",
      "Your own green escape",
      "garden-hero.png",
      "service",
      "s3",
    ],
    [
      "Indoor plants",
      "Bring the outdoors in",
      "plant-monstera.jpg",
      "shop",
      "Indoor plants",
    ],
    [
      "Succulents",
      "Small plants, big joy",
      "plant-succulent.jpg",
      "shop",
      "Succulents",
    ],
    [
      "Pots & planters",
      "A home for every plant",
      "terracotta-pots.jpg",
      "shop",
      "Pots & planters",
    ],
  ];
  return `<main id="main-content" tabindex="-1"><section class="container welcome-section"><div class="garden-welcome"><div class="welcome-copy"><div class="welcome-kicker">${icon("leaf")} A LITTLE CLOSER TO NATURE</div><h1>A greener space.<br>A <em>happier you.</em></h1><p>From your first little plant to the garden you’ve always imagined. Let’s grow something beautiful, together.</p><div class="welcome-actions"><a href="#services" class="btn btn-primary">Explore garden services ${icon("arrow")}</a><button class="welcome-shop" data-action="browse-category" data-id="All plants">Shop our plants ${icon("arrow")}</button></div><div class="welcome-note"><span class="tiny-leaves">${icon("leaf")}${icon("leaf")}${icon("leaf")}</span><span>Thoughtfully grown. Lovingly cared for.</span></div></div>${heroBanner()}</div></section>
    <section class="container nursery-benefits" aria-label="The Kaushik promise">${[
      ["leaf", "Grown with care", "Plants straight from our nursery"],
      [
        "shield",
        "Expert garden partners",
        "Approved professionals for your space",
      ],
      ["truck", "Delivered to your door", "Free delivery on orders ₹1,000+"],
      [
        "garden",
        "Here to help you grow",
        "Care guidance, every step of the way",
      ],
    ]
      .map(
        ([i, t, d]) =>
          `<div>${icon(i)}<span><strong>${t}</strong><small>${d}</small></span></div>`,
      )
      .join("")}</section>
    <section class="container collection-section"><div class="section-title compact-title"><div><span class="section-kicker">FIND YOUR KIND OF GREEN</span><h2>Every space has a green side.</h2></div><a href="#services" class="view-link">Let’s find yours ${icon("arrow")}</a></div><div class="collection-grid">${categories.map(([name, sub, img, kind, id]) => `<button class="collection-card" data-action="${kind === "service" ? "book" : "browse-category"}" data-id="${id}"><span class="collection-photo"><img src="${asset(img)}" alt="${esc(name)}" loading="lazy"><span>${icon("up")}</span></span><strong>${name}</strong><small>${sub}</small></button>`).join("")}</div></section>
    <section id="garden-services" class="container featured-services"><div class="section-title compact-title"><div><span class="section-kicker">YOUR GARDEN, IN GOOD HANDS</span><h2>A little vision. A little expert care.</h2><p>Meet the people who turn green dreams into everyday spaces.</p></div><a href="#services" class="view-link">View all services ${icon("arrow")}</a></div><div class="service-grid">${state.services
      .filter((s) => state.liveServiceIds?.includes(s.id))
      .slice(0, 3)
      .map(serviceCard)
      .join("")}</div></section>
    <section class="shop-feature"><div class="container"><div class="section-title compact-title"><div><span class="section-kicker">BUY OUR PRODUCTS</span><h2>Good company for your home.</h2><p>Plants and garden essentials, sold directly by Kaushik Nursery.</p></div><button class="view-link" data-action="browse-category" data-id="All plants">Explore the nursery ${icon("arrow")}</button></div><div class="product-grid">${[
      "p1",
      "p2",
      "p5",
      "p8",
    ]
      .map((id) => product(id))
      .filter(
        (p) => p && p.active !== false && state.categories.includes(p.category),
      )
      .map(productCard)
      .join(
        "",
      )}</div><div class="nursery-shop-note">${icon("leaf")} A little plant today. A greener everyday.</div></div></section>
    <section class="container inspiration-section"><div class="inspiration-card terrace-card"><img src="${asset("garden-design.jpg")}" alt="Flower-lined garden path" loading="lazy"><div><span class="section-kicker">MAKE ROOM FOR NATURE</span><h2>A bare corner.<br>A world of possibilities.</h2><a class="btn btn-white" href="#services">Plan your garden ${icon("arrow")}</a></div></div><div class="inspiration-card care-card"><span class="section-kicker">NEW TO PLANT PARENTING?</span>${icon("leaf")}<h2>A little care.<br>A lot of happy leaves.</h2><p>Find the right light, the right watering rhythm, and a little guidance along the way.</p><button class="view-link" data-action="support">Find your growing guide ${icon("arrow")}</button></div></section>
    <section id="how-it-works" class="container growing-section"><div class="section-title compact-title"><div><span class="section-kicker">FROM YOUR FIRST IDEA TO THE FINISHING TOUCH</span><h2>Your green dream, made simple.</h2></div><a href="#services" class="view-link">Get started ${icon("arrow")}</a></div><div class="growing-steps">${[
      [
        "01",
        "Tell us about your space",
        "Pick a service, choose a package, and share what you have in mind.",
      ],
      [
        "02",
        "Meet the right professional",
        "We match your request with approved garden partners near you.",
      ],
      [
        "03",
        "Let good things grow",
        "Follow your booking and enjoy a space that feels a little more alive.",
      ],
    ]
      .map(
        ([n, t, d]) => `<div><span>${n}</span><h3>${t}</h3><p>${d}</p></div>`,
      )
      .join("")}</div></section>
    <section class="container"><div class="android-banner"><div class="android-icon">${icon("garden")}</div><div><span class="section-kicker">YOUR GREEN WORLD, IN YOUR POCKET</span><h2>One nursery. A world of possibilities.</h2><p>Discover the customer and service partner Android experiences.</p></div><button class="btn btn-outline" data-action="app-info">Explore our apps ${icon("arrow")}</button></div></section>
    <section class="newsletter-section"><div class="container newsletter"><div><span class="section-kicker">LET’S KEEP GROWING</span><h2>A little inspiration in your inbox.</h2><p>Plant care ideas, fresh finds, and things worth growing.</p></div><form class="newsletter-form" data-form="newsletter"><label class="hidden" for="newsletter-email">Email address</label><input id="newsletter-email" type="email" name="email" placeholder="Your email address" required autocomplete="email"><button class="btn btn-primary" type="submit">Count me in ${icon("arrow")}</button></form></div></section></main>`;
}
function shop() {
  return `<main id="main-content" class="container shop-layout" tabindex="-1"><div class="store-breadcrumb"><a href="#home">Home</a><span>/</span><span>Buy our products</span>${shopCategory !== "All plants" ? `<span>/</span><span>${esc(shopCategory)}</span>` : ""}</div><div class="catalog-heading"><div><span class="section-kicker">STRAIGHT FROM OUR NURSERY</span><h1>${favoritesOnly ? "Your saved green companions." : shopCategory === "All plants" ? "A little green goes a long way." : esc(shopCategory) + "."}</h1><p>Thoughtfully grown plants and everyday garden essentials, directly from Kaushik Nursery.</p></div>${icon("leaf")}</div><div class="shop-controls"><div class="filters">${["All plants", ...state.categories].map((c) => `<button class="filter-chip ${shopCategory === c ? "active" : ""}" data-action="shop-filter" data-id="${esc(c)}">${c === "All plants" ? "All products" : esc(c)}</button>`).join("")}${favoritesOnly ? '<button class="filter-chip active" data-action="all-products">Saved plants ×</button>' : ""}</div><select id="product-sort" aria-label="Sort products"><option value="featured" ${shopSort === "featured" ? "selected" : ""}>Featured products</option><option value="price-low" ${shopSort === "price-low" ? "selected" : ""}>Price: low to high</option><option value="price-high" ${shopSort === "price-high" ? "selected" : ""}>Price: high to low</option></select></div><div class="catalog-search-row"><label class="search-field">${icon("search")}<input id="product-search" type="search" placeholder="Search this collection" value="${esc(shopQuery)}" aria-label="Search this collection"></label><span id="catalog-count" role="status" aria-live="polite">${catalogProducts().length} products found</span></div><div id="catalog-results" class="product-grid catalog-grid">${filteredProducts()}</div><div class="info-banner" style="margin-top:35px">${icon("truck")}Complimentary delivery on orders of ${money(1000)} or more. Final availability and pricing are checked at checkout.</div></main>`;
}
function catalogProducts() {
  return (state.catalogResults || state.products).filter(
    (p) =>
      (favoritesOnly || p.active !== false) &&
      (shopCategory === "All plants" || p.category === shopCategory) &&
      (!favoritesOnly || state.favorites.includes(p.id)) &&
      `${p.name} ${p.category}`.toLowerCase().includes(shopQuery.toLowerCase()),
  );
}
function filteredProducts() {
  let ps = catalogProducts();
  if (shopSort !== "featured")
    ps.sort((a, b) =>
      shopSort === "price-low" ? a.price - b.price : b.price - a.price,
    );
  return ps.length
    ? ps.map(productCard).join("")
    : `<div class="empty-state" style="grid-column:1/-1">${icon("leaf")}<h3>No plants found here yet.</h3><p>Try another search or save a plant you love.</p><button class="btn btn-outline" data-action="clear-shop">Explore all products</button></div>`;
}
function services() {
  return `<main id="main-content" class="container service-catalog" tabindex="-1"><div class="page-head"><div class="eyebrow">THE SERVICE MARKETPLACE</div><h1>Your green dream.<br><span class="serif">In good hands.</span></h1><p>Tell us about your space. We’ll connect your request with suitable, approved gardening professionals.</p></div><div class="filters rule">${["All services", ...new Set(state.services.filter((s) => state.liveServiceIds?.includes(s.id)).map((s) => s.category))].map((c) => `<button class="filter-chip ${serviceCategory === c ? "active" : ""}" data-action="service-filter" data-id="${esc(c)}">${esc(c)}</button>`).join("")}</div><div class="service-grid">${state.services
    .filter(
      (s) =>
        state.liveServiceIds?.includes(s.id) &&
        (serviceCategory === "All services" || s.category === serviceCategory),
    )
    .map(serviceCard)
    .join(
      "",
    )}</div><div class="info-banner" style="margin-top:30px">${icon("shield")}Every request is shared with a limited number of suitable professionals. The nursery retains control over the final assignment.</div></main>`;
}
function orders() {
  if (!state.user)
    return accessPanel("Sign in to view your orders and bookings.");
  let ls = state.myBookings || [];
  const ownOrders = state.myOrders || [];
  return `<main id="main-content" class="container orders-list" tabindex="-1"><div class="page-head"><div class="eyebrow">YOUR GREENER EVERYDAY</div><h1>Good things,<br><span class="serif">in progress.</span></h1><p>Keep your garden bookings and nursery purchases in their own little spaces.</p></div><div class="booking-tabs"><button class="${orderTab === "services" ? "active" : ""}" data-action="orders-tab" data-id="services">My service bookings (${ls.length})</button><button class="${orderTab === "products" ? "active" : ""}" data-action="orders-tab" data-id="products">My product orders (${ownOrders.length})</button></div>${orderTab === "services" ? (ls.length ? ls.map((l) => orderCard(l, "service")).join("") : empty("Your next garden story starts here.", "Browse services, share your idea and track your first booking.", "services", "Explore garden services")) : ownOrders.length ? ownOrders.map((o) => orderCard(o, "product")).join("") : empty("Something green is waiting for you.", "Choose a new companion from our nursery to start your order history.", "shop", "Meet our plants")}</main>`;
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
  return `<article class="order-card"><div class="order-top"><div><h3>${esc(isService ? o.serviceName : `Nursery order · ${o.items.reduce((a, c) => a + c.qty, 0)} items`)}</h3><p>${esc(o.id)} · ${isService ? dateLabel(o.date) : new Date(o.created).toLocaleDateString("en-IN")}</p></div>${tag(o.status)}</div><div class="order-body">${p ? `<img class="order-thumb" src="${asset(p.image)}" alt="${esc(p.name || o.serviceName)}">` : ""}<div class="order-details"><h4>${isService ? esc(o.package) : o.items.map((c) => `${esc(c.name || product(c.id)?.name)} × ${c.qty}`).join(", ")}</h4><p>${esc(o.address)}${isService ? ` · ${esc(o.time)}` : ""}</p><p>${isService ? (o.assigned ? `Partner: ${esc(o.partnerName || "Assigned professional")}` : "We’re finding the right hands for your garden.") : `${money(o.total)} · ${esc(o.payment || "Payment pending")}`}</p>${isService ? `<p>${money(o.price)} · ${esc(o.payment || "pending")}</p>` : ""}</div>${isService && !["Service completed", "Cancelled", "Service in progress"].includes(o.status) ? `<button class="btn btn-outline btn-small order-action" data-action="cancel-booking" data-id="${o.id}">Cancel request</button>` : ""}${isService && o.status === "Service completed" ? `<button class="btn btn-outline btn-small order-action" data-action="review" data-id="${o.id}">${o.review ? "View review" : "Leave a review"}</button>` : ""}${!isService && ["Awaiting payment", "Order placed", "Confirmed", "Processing"].includes(o.status) ? `<button class="btn btn-outline btn-small" data-action="cancel-order" data-id="${o.id}">Cancel order</button>` : ""}${!isService && o.status === "Awaiting payment" ? `<button class="btn btn-primary btn-small" data-action="pay-order" data-id="${o.id}">Complete payment</button>` : ""}${isService && o.uploads?.length ? `<div class="order-files">${fileLinks(o.uploads)}</div>` : ""}${isService && o.assigned && o.payment === "pending" && o.status !== "Cancelled" ? `<button class="btn btn-primary btn-small" data-action="pay-booking" data-id="${o.id}">Pay for service</button>` : ""}</div>${!["Cancelled", "Expired"].includes(o.status) ? `<div class="status-track">${steps.map((s, i) => `<div class="track-step ${i <= current ? "done" : ""}">${s}</div>`).join("")}</div>` : ""}</article>`;
}
const activePartner = () =>
  state.partners.find((p) => String(p.userId) === String(state.user?.id)) ||
  state.partners[0];
function table(headers, rows) {
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.join("") : `<tr><td colspan="${headers.length}"><div class="empty-state" style="padding:25px">Nothing here yet.</div></td></tr>`}</tbody></table></div>`;
}
function stat(label, value, note) {
  return `<div class="stat-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;
}
function customerPortalView() {
  if (!state.user) return accessPanel("Your account, your green space.");
  const user = state.user;
  const myOrders = state.myOrders || [];
  const myBookings = state.myBookings || [];
  const activeBookings = myBookings.filter(
    (b) => !["Cancelled", "Service completed"].includes(b.status),
  );
  const myTotalSpent = state.customerStats?.totalSpent || 0;

  let titles = {
    overview: "Your plant sanctuary, at a glance.",
    orders: "All your plant deliveries & tracking.",
    bookings: "Your booked garden services & visits.",
    saved: "Plants you love and saved.",
    addresses: "Your saved delivery addresses.",
    profile: "Your personal details & delivery preferences.",
  };

  let out = `<div class="workspace-heading"><div><h1>${titles[workspaceTab] || "Customer Portal"}</h1><p>Kaushik Nursery Customer Dashboard · Signed in as ${esc(user.name)}</p></div><span class="tag">${dateLabel(today())}</span></div>`;

  if (workspaceTab === "overview") {
    return (
      out +
      `<div class="stats-grid">
        ${stat("My Orders", state.customerStats?.orders || 0, "Plant & garden purchases")}
        ${stat("Service Bookings", state.customerStats?.bookings || 0, "Landscaping & maintenance")}
        ${stat("Paid nursery orders", money(myTotalSpent), "Captured payments excluding refunds")}
        ${stat("Saved Favorites", state.favorites.length, "Plants saved to wishlist")}
      </div>
      <div class="workspace-columns">
        <div class="panel">
          <div class="panel-heading"><h2>Recent nursery orders</h2><button class="btn btn-soft btn-small" data-action="workspace-tab" data-id="orders">View all ${icon("arrow")}</button></div>
          ${table(
            ["Order ID", "Items", "Amount", "Payment", "Status"],
            myOrders
              .slice(0, 4)
              .map(
                (o) =>
                  `<tr><td><strong>${esc(o.id)}</strong><small>${new Date(o.created).toLocaleDateString("en-IN")}</small></td><td>${o.items.map((c) => `${esc(c.name || product(c.id)?.name)} × ${c.qty}`).join(", ")}</td><td>${money(o.total)}</td><td>${tag(o.payment || "Paid")}</td><td>${tag(o.status)}</td></tr>`,
              ),
          )}
        </div>
        <div class="panel">
          <div class="panel-heading"><h2>Active service appointments</h2><button class="btn btn-soft btn-small" data-action="workspace-tab" data-id="bookings">View all ${icon("arrow")}</button></div>
          ${
            activeBookings.length
              ? activeBookings
                  .slice(0, 3)
                  .map(
                    (l) =>
                      `<div class="activity">${icon("garden")}<div><h4>${esc(l.serviceName)}</h4><p>${esc(l.package)} · ${dateLabel(l.date)} · ${tag(l.status)}</p></div></div>`,
                  )
                  .join("")
              : `<div class="empty-state" style="padding:20px">${icon("leaf")}<p>No active garden appointments yet.</p><a href="#services" class="btn btn-primary btn-small">Book a service ${icon("arrow")}</a></div>`
          }
        </div>
      </div>
      <div class="panel">
        <div class="panel-heading"><h2>Recommended plants for you</h2><a href="#shop" class="btn btn-soft btn-small">Shop catalog ${icon("arrow")}</a></div>
        <div class="product-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:15px">
          ${state.products
            .filter(
              (p) =>
                p.active !== false && state.categories.includes(p.category),
            )
            .slice(0, 4)
            .map(productCard)
            .join("")}
        </div>
      </div>`
    );
  }

  if (workspaceTab === "orders")
    return (
      out +
      `<div class="panel"><div class="panel-heading"><h2>My nursery orders</h2><a href="#shop" class="btn btn-primary btn-small">Shop plants</a></div>${myOrders.length ? myOrders.map((o) => orderCard(o, "product")).join("") : empty("Your first nursery order is waiting.", "Choose a plant to start your order history.", "shop", "Explore plants")}</div>`
    );
  if (workspaceTab === "bookings")
    return (
      out +
      `<div class="panel"><div class="panel-heading"><h2>My garden bookings</h2><a href="#services" class="btn btn-primary btn-small">Book a service</a></div>${myBookings.length ? myBookings.map((b) => orderCard(b, "service")).join("") : empty("Plan your next garden visit.", "Explore packages and request a professional.", "services", "Explore services")}</div>`
    );
  if (workspaceTab === "saved") {
    const favProducts = state.wishlistProducts || [];
    return (
      out +
      `<div class="panel">
        <div class="panel-heading"><h2>Saved wishlist (${favProducts.length})</h2><a href="#shop" class="btn btn-soft btn-small">Explore all plants ${icon("arrow")}</a></div>
        ${favProducts.length ? `<div class="product-grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px">${favProducts.map(productCard).join("")}</div>` : `<div class="empty-state" style="padding:40px">${icon("heart")}<h3>Your wishlist is empty</h3><p>Tap the heart icon on any plant to save it here for later.</p><a href="#shop" class="btn btn-primary">Discover plants ${icon("arrow")}</a></div>`}
      </div>`
    );
  }

  if (workspaceTab === "addresses") {
    const addresses = user.addresses || [];
    return (
      out +
      `<div class="panel">
        <div class="panel-heading">
          <div>
            <h2>My Delivery Addresses (${addresses.length})</h2>
            <p>Add and manage multiple delivery addresses for seamless plant orders and garden visits.</p>
          </div>
          <button class="btn btn-primary btn-small" data-action="address-add">${icon("plus")} Add New Address</button>
        </div>
        ${
          addresses.length
            ? `<div class="address-cards-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">
                ${addresses
                  .map(
                    (addr) => `
                  <div class="address-card ${addr.isDefault ? "default" : ""}" style="background:#fff;border:1px solid ${addr.isDefault ? "var(--forest,#153e2e)" : "#dde4d4"};border-radius:8px;padding:16px;position:relative;display:flex;flex-direction:column;justify-content:space-between">
                    <div>
                      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                        <span style="font-weight:700;font-size:12px;color:var(--forest,#153e2e);display:flex;align-items:center;gap:6px">
                          ${icon("pin")} ${esc(addr.tag || "Home")}
                        </span>
                        ${addr.isDefault ? '<span class="tag green" style="background:#dcead0;color:#244d38;font-size:9px">Default</span>' : ""}
                      </div>
                      <p style="font-size:12px;line-height:1.6;margin:0 0 6px;color:#1e3527"><strong>${esc(addr.name || user.name)}</strong> · ${esc(addr.phone || user.phone)}</p>
                      <p style="font-size:11px;line-height:1.6;margin:0 0 4px;color:#536757">${esc(addr.line)}</p>
                      <p style="font-size:11px;color:#7a8a7c;margin:0">${esc(addr.city)}${addr.pincode ? ` - ${esc(addr.pincode)}` : ""}</p>
                    </div>
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:14px;padding-top:10px;border-top:1px dashed #e1e8d9">
                      ${!addr.isDefault ? `<button class="btn btn-soft btn-small" data-action="address-set-default" data-id="${addr.id}" style="font-size:10px;padding:4px 8px">Set as Default</button>` : '<span style="font-size:10px;color:var(--muted)">Primary delivery</span>'}
                      <div style="display:flex;gap:6px">
                        <button class="btn btn-outline btn-small" data-action="address-edit" data-id="${addr.id}" style="font-size:10px;padding:4px 8px">Edit</button>
                        <button class="btn btn-outline btn-small" data-action="address-delete" data-id="${addr.id}" style="font-size:10px;padding:4px 8px;color:#ba4c4c">Delete</button>
                      </div>
                    </div>
                  </div>
                `,
                  )
                  .join("")}
              </div>`
            : `<div class="empty-state" style="padding:40px">
                ${icon("pin")}
                <h3>No saved addresses yet</h3>
                <p>Save multiple home, balcony, terrace, or office addresses for fast checkout.</p>
                <button class="btn btn-primary" data-action="address-add">${icon("plus")} Add Your First Address</button>
              </div>`
        }
      </div>`
    );
  }

  if (workspaceTab === "profile") {
    const addresses = user.addresses || [];
    return (
      out +
      `<div class="panel">
        <div class="panel-heading"><h2>Customer Profile & Preferences</h2></div>
        <form data-form="customer-profile">
          <div class="form-grid">
            <label class="field"><span>Full Name</span><input name="name" value="${esc(user.name)}" required maxlength="60"></label>
            <label class="field"><span>Contact phone</span><input name="contactPhone" type="tel" inputmode="numeric" pattern="[+0-9]{10,16}" value="${esc(user.contactPhone || "")}"></label>
            <label class="field"><span>Email Address</span><input name="email" type="email" value="${esc(user.email || "")}" readonly></label>
            <label class="field"><span>Default City</span><select name="city">${["Hyderabad", "Bengaluru", "Chennai", "Vijayawada"].map((c) => `<option ${c === (user.city || state.city) ? "selected" : ""}>${c}</option>`).join("")}</select></label>

          </div>
          <div class="modal-footer"><small>Profile updates synchronize across your customer experience.</small><button class="btn btn-primary" type="submit">Save Customer Details ${icon("check")}</button><button type="button" class="btn btn-outline" data-action="change-password">Change password</button></div>
        </form>
      </div>
      <div class="panel">
        <div class="panel-heading">
          <h2>Delivery Addresses (${addresses.length})</h2>
          <button class="btn btn-soft btn-small" data-action="workspace-tab" data-id="addresses">Manage all addresses ${icon("arrow")}</button>
        </div>
        <p style="font-size:12px;color:var(--muted);margin-bottom:12px">You have ${addresses.length} saved delivery ${addresses.length === 1 ? "address" : "addresses"}. You can add work, parents', or vacation garden addresses.</p>
        <button class="btn btn-outline btn-small" data-action="address-add">${icon("plus")} Add Another Address</button>
      </div>`
    );
  }

  return out;
}

function shell(kind) {
  let isCustomer = kind === "customer-admin";
  let partner = kind === "partner";
  let p = activePartner();

  if (!state.user) return accessPanel("Sign in to your green space.");
  if (!isCustomer && !partner && state.user.role !== "admin")
    return accessPanel("Administrator access is required.", false);
  if (partner && state.user.role !== "partner")
    return `<main class="container" style="padding-top:60px;padding-bottom:60px"><h1>Grow with us.</h1><p>Apply to join our garden service professionals.</p><button class="btn btn-primary" data-action="partner-register">Apply to become a partner ${icon("arrow")}</button></main>`;
  if (partner && !p)
    return accessPanel("Your partner profile is unavailable.", false);
  let tabs;
  if (isCustomer) {
    tabs = [
      ["overview", "dashboard", "My Overview"],
      ["orders", "bag", "My Orders"],
      ["bookings", "calendar", "Garden Bookings"],
      ["saved", "heart", "Wishlist Plants"],
      ["addresses", "pin", "Saved Addresses"],
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
      ["jobs", "shield", "System jobs"],
      ["business", "user", "Business details"],
      ["hero", "leaf", "Homepage banners"],
    ];
  }

  if (!tabs.some((t) => t[0] === workspaceTab)) workspaceTab = "overview";

  let avatarLabel = isCustomer
    ? esc((state.user?.name || "C")[0])
    : partner
      ? esc(p.name[0])
      : "👑";
  let titleLabel = isCustomer
    ? esc(state.user?.name || "Customer Account")
    : partner
      ? esc(p.name)
      : "Super Administrator";
  let roleLabel = isCustomer
    ? "CUSTOMER PORTAL"
    : partner
      ? "SERVICE PARTNER"
      : "SUPER ADMIN SYSTEM CONTROL";
  let statusBadge = isCustomer
    ? state.user
      ? "Signed in"
      : "Guest Account"
    : partner
      ? p.status
      : "Super Admin";

  return `<main class="workspace-shell workspace-shell-${kind}">
    <aside class="workspace-sidebar">
      <div class="sidebar-profile">
        <div class="avatar">${avatarLabel}</div>
        <h3>${titleLabel}</h3>
        <p>${roleLabel}</p>
        ${tag(statusBadge)}
      </div>
      ${tabs.map(([id, ic, label]) => `<button class="sidebar-item ${workspaceTab === id ? "active" : ""}" data-action="workspace-tab" data-id="${id}">${icon(ic)}${label}</button>`).join("")}
      ${
        !isCustomer && !partner
          ? `
        <div style="margin-top:16px;padding-top:14px;border-top:1px solid #dce3d4;display:flex;flex-direction:column;gap:6px">
          <a href="#home" class="sidebar-item" style="color:var(--forest)">${icon("arrow")} Back to Store</a>
          <button class="sidebar-item" data-action="super-admin-lock" style="color:#c04b4b">${icon("logout")}Lock Super Admin</button>
        </div>`
          : ""
      }
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
  let out = `<div class="workspace-heading"><div><h1>${heading[0]}</h1><p>${heading[1]}</p></div>${["Pending", "Rejected"].includes(p.status) ? '<button class="btn btn-outline btn-small" data-action="partner-register">Update application</button>' : ""}</div>`;
  if (p.status !== "Approved")
    return (
      out +
      `<div class="info-banner">${icon("shield")}Your application is ${esc(p.status.toLowerCase())}. Nursery approval is required before you receive service leads.</div>${partnerProfile(p)}`
    );
  if (workspaceTab === "profile") return out + partnerProfile(p);
  if (workspaceTab === "leads")
    return (
      out +
      `<div class="info-banner">${icon("shield")}Accept a lead to receive its assignment. Once assigned, it closes for the other partners. Nursery admin can reassign it.</div><div class="lead-grid">${incoming.length ? incoming.map((l) => leadCard(l, p)).join("") : empty("A little pause before the next project.", "New matching leads will appear here.", "services", "Explore garden services")}</div>`
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
        `<tr><td><strong>${esc(l.serviceName)}</strong><small>${esc(l.id)}</small></td><td>${esc(l.customer)}<small>${esc(l.address)} · ${esc(l.phone)}</small><small>${fileLinks(l.uploads)}</small></td><td>${dateLabel(l.date)}<small>${esc(l.time)}</small></td><td>${tag(l.status)}</td><td>${!["Service completed", "Cancelled"].includes(l.status) ? `<button class="btn btn-soft btn-small" data-action="job-update" data-id="${l.id}">Update job</button>` : l.review ? `${l.review.rating}/5 stars` : "Completed"}</td></tr>`,
    ),
  );
}
function partnerProfile(p) {
  return `<div class="panel"><div class="panel-heading"><h2>Your partner details</h2>${tag(p.status)}</div><form data-form="partner-profile"><div class="form-grid"><label class="field"><span>Business / professional name</span><input name="name" value="${esc(p.name)}" required maxlength="70"></label><label class="field"><span>Your name</span><input name="person" value="${esc(p.person)}" required maxlength="60"></label><label class="field"><span>City</span><select name="city">${["Hyderabad", "Bengaluru", "Chennai", "Vijayawada"].map((c) => `<option ${c === p.city ? "selected" : ""}>${c}</option>`).join("")}</select></label><label class="field"><span>Experience</span><input name="experience" value="${esc(p.experience || "3 years")}" placeholder="Years of experience" maxlength="60"></label><label class="field full"><span>Approved services</span><select name="category" disabled><option value="all" ${p.categories.length === 3 ? "selected" : ""}>All gardening categories</option>${state.serviceCategories.map((c) => `<option ${p.categories.length === 1 && p.categories.includes(c) ? "selected" : ""}>${c}</option>`).join("")}</select></label><label class="field full"><span>Contact mobile number</span><input name="phone" inputmode="numeric" pattern="[0-9]{10}" value="${esc(p.phone || "")}" readonly></label></div><div class="settings-line"><div>Available for new leads<p>Pause new requests when your schedule is full.</p></div><input type="checkbox" name="available" ${p.available ? "checked" : ""} aria-label="Available for new leads"></div><div class="modal-footer"><small>Save your partner profile and availability.</small><button class="btn btn-primary" type="submit">Save profile ${icon("check")}</button></div></form></div>`;
}
function orderStatusOptions(o) {
  const next = {
    "Order placed": "Confirmed",
    Confirmed: "Processing",
    Processing: "Dispatched",
    Dispatched: "Delivered",
  };
  return [
    o.status,
    ...(o.payment === "captured" && next[o.status] ? [next[o.status]] : []),
    ...([
      "Awaiting payment",
      "Order placed",
      "Confirmed",
      "Processing",
    ].includes(o.status)
      ? ["Cancelled"]
      : []),
  ];
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
    jobs: "Background processing & recovery.",
    business: "Your public nursery details.",
    hero: "The first glimpse of your nursery.",
  };
  let out = `<div class="workspace-heading"><div><h1>${names[workspaceTab]}</h1><p>Kaushik Nursery · Administration · Live platform data</p></div>${workspaceTab === "products" ? '<button class="btn btn-primary btn-small" data-action="product-edit" data-id="new">' + icon("plus") + "Add product</button>" : workspaceTab === "services" ? '<button class="btn btn-primary btn-small" data-action="service-edit" data-id="new">' + icon("plus") + "Add service</button>" : `<span class="tag">${dateLabel(today())}</span>`}</div>`;
  if (workspaceTab === "hero")
    return out + bannerEditor(state, { esc, asset, assetOptions });
  if (workspaceTab === "overview")
    return (
      out +
      `<div class="stats-grid">${stat("Active service requests", state.stats.activeBookings ?? active.length, "Across all approved partners")}${stat("Partner approvals", state.stats.pendingPartners ?? pending.length, "Applications awaiting review")}${stat("Product orders", state.stats.orders ?? state.orders.length, "Direct nursery purchases")}${stat("Captured payments", money(state.stats.capturedAmount || 0), state.paymentMode === "test" ? "Test transactions only" : "Verified product and service payments")}</div><div class="workspace-columns"><div class="panel"><div class="panel-heading"><h2>Lead allocation</h2><span class="tag">${state.maxPartners} partners max</span></div>${leadTable(state.leads.slice(0, 5), true)}</div><div class="panel"><div class="panel-heading"><h2>Recent activity</h2></div>${state.leads
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
      `<div class="panel"><div class="panel-heading"><h2>Customer directory</h2></div><form data-form="admin-user-search" class="portal-search"><label class="field"><span>Find by email, phone or name prefix</span><input name="query" type="search" maxlength="100" value="${esc(state.adminUserQuery || "")}"></label><button type="submit" class="btn btn-outline">Search users</button></form>${table(
        ["Name", "Email", "Role", "Status", "Manage"],
        state.users.map(
          (u) =>
            `<tr><td>${esc(u.name)}</td><td>${esc(u.email || "—")}</td><td>${esc(u.role)}</td><td>${tag(u.status)}</td><td>${u.role !== "admin" ? `<button class="btn btn-soft btn-small" data-action="user-status" data-id="${u.id}" data-status="${u.status === "active" ? "disabled" : "active"}">${u.status === "active" ? "Disable" : "Activate"}</button>` : "Administrator"}</td></tr>`,
        ),
      )}</div>`
    );
  if (workspaceTab === "products")
    return (
      out +
      `<div class="panel"><div class="panel-heading"><h2>Nursery catalog</h2><button class="btn btn-soft btn-small" data-action="category-create">Add category</button></div>${table(
        ["Product", "Category", "Price", "Stock", "Manage"],
        state.products.map(
          (p) =>
            `<tr><td><div class="table-product"><img src="${asset(p.image)}" alt="${esc(p.name)}"><strong>${esc(p.name)}</strong></div></td><td>${esc(p.category)}</td><td>${money(p.price)}</td><td>${p.stock} available</td><td><button class="btn btn-soft btn-small" data-action="product-edit" data-id="${p.id}">Edit</button></td></tr>`,
        ),
      )}</div>${categoryControls("product")}<div class="panel"><div class="panel-heading"><h2>Product orders</h2></div>${table(
        ["Order", "Customer", "Total", "Payment", "Status"],
        state.orders.map(
          (o) =>
            `<tr><td>${esc(o.id)}<small>${o.items.length} product types</small></td><td>${esc(o.name)}<small>${esc(o.address)}</small></td><td>${money(o.total)}</td><td>${tag(o.payment)}</td><td><select class="order-status-select" data-id="${o.id}" aria-label="Order status for ${o.id}" ${orderStatusOptions(o).length === 1 ? "disabled" : ""}>${orderStatusOptions(
              o,
            )
              .map(
                (s) =>
                  `<option ${s === o.status ? "selected" : ""}>${s}</option>`,
              )
              .join("")}</select></td></tr>`,
        ),
      )}</div>`
    );
  if (workspaceTab === "payments")
    return (
      out +
      `<div class="info-banner">${icon("shield")}${state.paymentMode === "test" ? "Test environment. All payments here are simulated." : "Payment status is verified with the gateway. Refunds are processed by the background worker."}</div><div class="panel"><h2>Product & service payments</h2>${table(
        ["Payment", "Order / booking", "Amount", "Status", "Refund"],
        state.payments.map(
          (p) =>
            `<tr><td>${esc(p.id)}</td><td>${esc(p.order_id || p.booking_id)}</td><td>${money(p.amount_paise / 100)}</td><td>${tag(p.status)}</td><td>${p.refund_status ? tag(p.refund_status) : p.status === "captured" ? `<button class="btn btn-soft btn-small" data-action="payment" data-id="${p.id}">Request full refund</button>` : "—"}</td></tr>`,
        ),
      )}</div>`
    );
  if (workspaceTab === "services")
    return (
      out +
      `<div class="panel"><div class="panel-heading"><h2>Service catalog</h2><button class="btn btn-soft btn-small" data-action="service-category-create">Add category</button></div>${table(
        ["Service", "Category", "From", "Packages", "Manage"],
        state.services.map(
          (s) =>
            `<tr><td><strong>${esc(s.name)}</strong></td><td>${esc(s.category)}</td><td>${money(s.price)}</td><td>${s.packages.length}</td><td><button class="btn btn-soft btn-small" data-action="service-edit" data-id="${s.id}">Edit</button></td></tr>`,
        ),
      )}</div>${categoryControls("service")}`
    );
  if (workspaceTab === "settings")
    return (
      out +
      `<div class="panel"><div class="panel-heading"><h2>Limited lead distribution</h2></div><form data-form="lead-settings"><div class="settings-line"><div>Maximum partners per request<p>Only suitable partners receive a lead. Default: 6.</p></div><input type="number" name="maxPartners" value="${state.maxPartners}" min="1" max="20" required aria-label="Maximum partners per lead"></div><div class="settings-line"><div>Rotate matching partners<p>Prioritise partners who have received fewer leads.</p></div><input type="checkbox" name="rotation" ${state.rotation ? "checked" : ""} aria-label="Rotate partners"></div><div class="settings-line"><div>Partner eligibility<p>Approved + available + matching service category + matching city.</p></div>${tag("Enabled")}</div><div class="settings-line"><div>Admin assignment control<p>Assign, override, reassign or cancel any lead.</p></div>${tag("Enabled")}</div><div class="modal-footer"><small>Changes apply to new requests.</small><button class="btn btn-primary">Save distribution rules ${icon("check")}</button></div></form></div>`
    );
  if (workspaceTab === "notifications")
    return (
      out +
      `<div class="panel"><div class="panel-heading"><h2>Compose an update</h2></div><form data-form="notification"><div class="form-grid"><label class="field full"><span>Audience</span><select name="audience"><option>All customers</option><option>All service partners</option><option>All customers and partners</option></select></label><label class="field full"><span>Title</span><input name="title" placeholder="A fresh update from the nursery" required maxlength="100"></label><label class="field full"><span>Message</span><textarea name="message" placeholder="What would you like to share?" required maxlength="500"></textarea></label></div><div class="modal-footer"><small>Recipients receive an in-app notification.</small><button class="btn btn-primary">Queue notification ${icon("bell")}</button></div></form></div><div class="panel"><div class="panel-heading"><h2>Recent broadcasts</h2></div>${table(
        ["Title", "Audience", "Message"],
        (state.broadcasts || []).map(
          (n) =>
            `<tr><td>${esc(n.title)}</td><td>${esc(n.audience)}</td><td>${esc(n.message)}</td></tr>`,
        ),
      )}</div>`
    );
  if (workspaceTab === "jobs")
    return (
      out +
      `<div class="panel"><h2>Background jobs</h2>${table(
        ["Job", "Type", "Status", "Attempts", "Last error", "Action"],
        (state.adminJobs || []).map(
          (j) =>
            `<tr><td>${esc(j.id)}</td><td>${esc(j.type)}</td><td>${tag(j.status)}</td><td>${j.attempts}</td><td>${esc(j.last_error || "—")}</td><td>${j.status === "failed" ? `<button class="btn btn-outline btn-small" data-action="retry-job" data-id="${j.id}">Retry failed job</button>` : "—"}</td></tr>`,
        ),
      )}</div>`
    );
  if (workspaceTab === "business") {
    const b = state.business || {};
    return (
      out +
      `<div class="panel"><h2>Public support details</h2><form data-form="business-profile"><div class="form-grid"><label class="field full"><span>Business name</span><input name="name" value="${esc(b.name || "Kaushik Nursery")}" maxlength="160" required></label><label class="field"><span>Support email</span><input name="email" type="email" value="${esc(b.email || "")}" maxlength="254"></label><label class="field"><span>Support phone</span><input name="phone" type="tel" pattern="[+0-9]{10,16}" value="${esc(b.phone || "")}"></label><label class="field full"><span>Business address</span><textarea name="address" maxlength="1000">${esc(b.address || "")}</textarea></label></div><p>Saved details are shown publicly in Contact us. Final legal policies and business commitments require nursery review.</p><div class="modal-footer"><button type="submit" class="btn btn-primary">Save public details</button></div></form></div>`
    );
  }
  if (workspaceTab === "reports")
    return (
      out +
      `<div class="panel"><div class="panel-heading"><h2>Download a clear picture</h2><p>CSV exports from the database</p></div>${[
        ["leads", "Service requests & leads", state.leads.length],
        ["partners", "Service partner directory", state.partners.length],
        ["orders", "Product orders & payments", state.orders.length],
        ["products", "Catalog & stock", state.products.length],
      ]
        .map(
          ([id, label, count]) =>
            `<div class="settings-line"><div>${label}<p>${count} loaded · export includes all records</p></div><button class="btn btn-outline btn-small" data-action="export" data-id="${id}">${icon("download")}Export CSV</button></div>`,
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
        `<tr><td><strong>${esc(l.serviceName)}</strong><small>${esc(l.id)}${compact ? "" : ` · ${esc(l.customer)} · ${esc(l.phone)}${fileLinks(l.uploads)}`}${l.sample ? " · Sample" : ""}</small></td>${compact ? "" : `<td>${esc(l.city)}<small>${dateLabel(l.date)} · ${esc(l.time)}</small></td><td>${l.recipients.length} partners<small>${l.declined.length} declined</small></td>`}<td>${tag(l.status)}</td><td>${esc(state.partners.find((p) => p.id === l.assigned)?.name || "Awaiting assignment")}</td><td><div class="table-actions">${!["Service completed", "Cancelled"].includes(l.status) ? `<button class="btn btn-soft" data-action="assign" data-id="${l.id}">${l.assigned ? "Reassign" : "Assign"}</button>` : ""}${l.status !== "Cancelled" && l.status !== "Service completed" ? `<button class="btn btn-outline" data-action="cancel-booking" data-id="${l.id}">Cancel</button>` : ""}</div></td></tr>`,
    ),
  );
}
function partnersTable(partners) {
  return table(
    ["Partner", "Location / services", "Status", "Available", "Manage"],
    partners.map(
      (p) =>
        `<tr><td><strong>${esc(p.name)}</strong><small>${esc(p.person)}</small></td><td>${esc(p.city)}<small>${p.categories.map(esc).join(", ")}</small></td><td>${tag(p.status)}</td><td>${p.available ? "Yes" : "No"}</td><td><div class="table-actions">${p.status === "Pending" ? `<button class="btn btn-primary" data-action="partner-status" data-id="${p.id}" data-status="Approved">Approve</button><button class="btn btn-outline" data-action="partner-status" data-id="${p.id}" data-status="Rejected">Reject</button>` : `<button class="btn btn-soft" data-action="partner-status" data-id="${p.id}" data-status="${p.status === "Approved" ? "Suspended" : "Approved"}">${p.status === "Approved" ? "Suspend" : "Activate"}</button>`}</div>${p.uploads?.length ? `<small>Documents: ${fileLinks(p.uploads)}</small>` : ""}</td></tr>`,
    ),
  );
}
function render(scroll = false) {
  disposeStorefront();
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
  if (route === "shop") {
    fetchCatalog();
  }
  addPagination();
  disposeStorefront = mountStorefrontInteractions();
  if (backendError)
    $("#app").insertAdjacentHTML(
      "afterbegin",
      `<div class="backend-status" role="alert">The nursery service is unavailable. Please refresh to try again.</div>`,
    );
  document.title = `${{ home: "Plants, garden services & a greener everyday", shop: "Buy our products", services: "Garden services", orders: "My bookings", partner: "Partner workspace", admin: "Super Admin", "super-admin": "Super Admin Portal", "customer-admin": "Customer Admin Portal" }[route]} · Kaushik Nursery`;
}
function navigate() {
  if (location.hash.startsWith("#reset-password/")) {
    render();
    authForm("reset", location.hash.split("/")[1]);
    return;
  }
  let next = location.hash.slice(1).split("/")[0] || "home";
  if (
    ![
      "home",
      "shop",
      "services",
      "orders",
      "partner",
      "admin",
      "super-admin",
      "customer-admin",
    ].includes(next)
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
  const cartCategories = state.cart
    .map((c) => product(c.id)?.category)
    .filter(Boolean);

  let similarProducts = state.products.filter(
    (p) =>
      !cartIds.includes(p.id) &&
      (cartCategories.includes(p.category) || !cartCategories.length),
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
                        <div class="price">${money(p.price * c.qty)}</div>${p.active === false || p.stock < c.qty ? '<small role="status">Unavailable at this quantity</small>' : ""}
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
                ${cartUnavailable() ? '<p role="alert">Remove unavailable items or reduce quantities before checkout.</p>' : ""}<button class="btn btn-primary" data-action="checkout" ${cartUnavailable() ? "disabled" : ""}>Continue to checkout ${icon("arrow")}</button>
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
  if (!p || p.active === false || p.stock < 1)
    return toast("This item is currently out of stock.");
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
    `<div class="product-detail"><img src="${asset(p.image)}" alt="${esc(p.name)}"><div><div class="eyebrow">${esc(p.category)}</div><h2>${esc(p.name)}</h2><div class="price">${money(p.price)}${p.oldPrice ? `<del>${money(p.oldPrice)}</del>` : ""}</div><p>${esc(p.description)}</p><div class="detail-care">${icon("sun")}${esc(p.care)}</div><div class="detail-care">${icon("drop")}${esc(p.water)}</div><div class="detail-care">${icon("leaf")}${p.stock > 0 ? `${p.stock} available · Sold by Kaushik Nursery` : "Currently out of stock"}</div><div class="detail-cta"><button class="btn btn-primary" data-action="add-cart" data-id="${p.id}" ${p.active === false || p.stock < 1 ? "disabled" : ""}>Add to bag ${icon("plus")}</button><button class="icon-btn" data-action="favorite" data-id="${p.id}" aria-label="Save plant">${icon("heart")}</button></div><p class="field-note" style="margin-top:20px">Illustrative nursery photography. Availability and prices are confirmed at checkout.</p></div></div>`,
    true,
  );
}
function matchingPartners() {
  return [];
}
function startBooking(id) {
  if (!state.user) return account();
  if (!service(id))
    return toast("This service is unavailable. Please try again later.");
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
    out += `<img class="modal-service-image" src="${asset(s.image)}" alt="${esc(s.name)}"><div class="package-grid">${s.packages.map((p, i) => `<button class="package ${modalState.packageIndex === i ? "selected" : ""}" data-action="select-package" data-id="${i}"><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><strong>${money(p.price)}</strong></button>`).join("")}</div><p class="field-note">Any additional work or materials are subject to confirmation.</p><div class="modal-footer"><small>Step 1 of 3 · Choose a package</small><button class="btn btn-primary" data-action="booking-next">Your requirements ${icon("arrow")}</button></div>`;
  if (step === 2)
    out += `<form data-form="booking-details"><div class="form-grid"><label class="field"><span>Your name</span><input name="name" value="${esc(f.name)}" autocomplete="name" required maxlength="60"></label><label class="field"><span>Mobile number</span><input name="phone" type="tel" inputmode="numeric" pattern="[0-9]{10}" value="${esc(f.phone)}" placeholder="10-digit mobile number" required></label><label class="field"><span>Property type</span><select name="property">${["Apartment", "Independent home", "Commercial property", "Other"].map((c) => `<option ${f.property === c ? "selected" : ""}>${c}</option>`).join("")}</select></label><label class="field"><span>Approximate area (sq ft)</span><input name="area" type="number" min="1" max="1000000" value="${esc(f.area || "")}" placeholder="e.g. 250" required></label><label class="field"><span>Preferred date</span><input name="date" type="date" min="${today()}" value="${esc(f.date || "")}" required></label><label class="field"><span>Preferred time</span><input name="time" type="time" value="${esc(f.time || "09:00")}" required></label><label class="field"><span>City</span><select name="city">${["Hyderabad", "Bengaluru", "Chennai", "Vijayawada"].map((c) => `<option ${f.city === c ? "selected" : ""}>${c}</option>`).join("")}</select></label><label class="field"><span>Service address</span><input name="address" value="${esc(f.address || "")}" placeholder="Area, building & street" required maxlength="200"></label><label class="field full"><span>Your requirements & special instructions</span><textarea name="description" placeholder="Tell us about your space and what you have in mind…" required maxlength="1000">${esc(f.description || "")}</textarea></label><label class="field full"><span>Reference images (optional)</span><input name="images" type="file" accept="image/*" multiple><p class="field-note">Attach photos to help the professional understand your space.</p></label></div><div class="modal-footer"><button type="button" class="text-link" data-action="booking-back">Back</button><button class="btn btn-primary" type="submit">Review request ${icon("arrow")}</button></div></form>`;
  if (step === 3) {
    let matches = matchingPartners(s, f.city);
    out += `<div class="summary-line"><span>Service</span><strong>${esc(s.name)}</strong></div><div class="summary-line"><span>Package</span><span>${esc(p.name)} · ${money(p.price)}</span></div><div class="summary-line"><span>Your space</span><span>${esc(f.property)} · ${esc(f.area)} sq ft</span></div><div class="summary-line"><span>Preferred visit</span><span>${dateLabel(f.date)} · ${esc(f.time)}</span></div><div class="summary-line"><span>Location</span><span>${esc(f.address)}, ${esc(f.city)}</span></div><div class="summary-line"><span>Requirements</span><span>${esc(f.description)}</span></div>${f.images?.length ? `<div class="summary-line"><span>References</span><span>${f.images.map(esc).join(", ")}</span></div>` : ""}<div class="info-banner">${icon("shield")}${matches.length ? `Your request will reach suitable, approved partners. Final assignment remains under nursery control.` : "We match professionals by service category, city and availability. If none are available, your request goes to the nursery for review."}</div><p class="field-note">Your request is sent to eligible professionals. The nursery controls the final assignment.</p><div class="modal-footer"><button class="text-link" data-action="booking-back">Edit details</button><button class="btn btn-primary" data-action="submit-booking">Submit service request ${icon("arrow")}</button></div>`;
  }
  openModal(out);
}
function showAddressModal(id = null) {
  const isEdit = Boolean(id);
  const addresses = state.user?.addresses || [];
  const target = isEdit
    ? addresses.find((a) => a.id === id) || {}
    : {
        tag: "Home",
        name: state.user?.name || "",
        phone: state.user?.phone || "",
        line: "",
        city: state.city || "Hyderabad",
        pincode: "",
        isDefault: !addresses.length,
      };

  modalState = {
    title: isEdit ? "Edit delivery address" : "Add new delivery address",
    id,
  };
  openModal(
    `<div class="eyebrow">${isEdit ? "UPDATE SAVED ADDRESS" : "ADD DELIVERY ADDRESS"}</div>
     <h2>${isEdit ? "Edit address." : "Where should we deliver?"}</h2>
     <p class="modal-intro">Save multiple homes, terrace setups or office locations for quick checkout.</p>
     <form data-form="address-save">
       <input type="hidden" name="id" value="${esc(target.id || "")}">
       <div class="form-grid">
         <label class="field">
           <span>Address Tag / Label</span>
           <select name="tag">
             ${[
               "Home",
               "Work / Office",
               "Balcony Garden",
               "Terrace Farm",
               "Parents",
               "Other",
             ]
               .map(
                 (t) =>
                   `<option ${target.tag === t ? "selected" : ""}>${t}</option>`,
               )
               .join("")}
           </select>
         </label>
         <label class="field">
           <span>Contact Name</span>
           <input name="name" value="${esc(target.name || state.user?.name || "")}" required maxlength="60">
         </label>
         <label class="field">
           <span>Phone Number</span>
           <input name="phone" type="tel" pattern="[0-9]{10}" inputmode="numeric" value="${esc(target.phone || state.user?.phone || "")}" required placeholder="10-digit number">
         </label>
         <label class="field">
           <span>City</span>
           <select name="city">
             ${["Hyderabad", "Bengaluru", "Chennai", "Vijayawada"]
               .map(
                 (c) =>
                   `<option ${target.city === c ? "selected" : ""}>${c}</option>`,
               )
               .join("")}
           </select>
         </label>
         <label class="field full">
           <span>Complete Street Address & Landmark</span>
           <textarea name="line" required placeholder="Flat / House no, building, street, area, landmark" maxlength="300">${esc(target.line || "")}</textarea>
         </label>
         <label class="field">
           <span>Postal PIN Code</span>
           <input name="pincode" pattern="[0-9]{6}" inputmode="numeric" value="${esc(target.pincode || "")}" required placeholder="6-digit PIN">
         </label>
         <label class="field" style="display:flex;align-items:center;gap:10px;margin-top:24px">
           <input type="checkbox" name="isDefault" ${target.isDefault ? "checked" : ""} style="width:16px;height:16px">
           <span style="margin:0">Set as primary default address</span>
         </label>
       </div>
       <div class="modal-footer">
         <button type="button" class="btn btn-outline" data-action="close">Cancel</button>
         <button class="btn btn-primary" type="submit">Save Address ${icon("check")}</button>
       </div>
     </form>`,
  );
}

function showCheckout() {
  if (!state.user) return account();
  if (!state.cart.length) return;
  if (cartUnavailable())
    return toast(
      "Remove unavailable items or reduce quantities before checkout.",
    );
  modalState = { title: "Checkout", kind: "checkout" };
  const totalAmount = cartTotal() + delivery();
  const addresses = state.user?.addresses || [];
  const defAddr = addresses.find((a) => a.isDefault) || addresses[0];

  openModal(
    `<div class="eyebrow">${state.paymentMode === "test" ? "TEST CHECKOUT · NO MONEY COLLECTED" : "NURSERY CHECKOUT"}</div>
     <h2>A new home for your plants.</h2>
     <p class="modal-intro">${state.paymentMode === "test" ? "Choose a delivery address to try a simulated checkout. No money is collected." : "Choose a delivery address and pay securely with Razorpay (Cards, UPI, NetBanking)."}</p>
     <form data-form="checkout">
       ${
         addresses.length
           ? `<div style="margin-bottom:16px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                  <span style="font-size:11px;font-weight:700;color:var(--forest,#153e2e)">SELECT SAVED ADDRESS</span>
                  <a href="#customer-admin" data-action="close-link" style="font-size:11px;color:var(--forest);text-decoration:underline">+ Manage in portal</a>
                </div>
                <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:6px">
                  ${addresses
                    .map(
                      (a, idx) => `
                    <label style="border:1px solid ${a.id === defAddr?.id ? "var(--forest,#153e2e)" : "#dde4d4"};background:${a.id === defAddr?.id ? "#f3f7ee" : "#fff"};border-radius:7px;padding:10px 14px;cursor:pointer;min-width:200px;flex-shrink:0;font-size:11px">
                      <div style="display:flex;align-items:center;gap:6px;font-weight:700;margin-bottom:4px">
                        <input type="radio" name="selected_address_id" value="${a.id}" ${a.id === defAddr?.id ? "checked" : ""} data-action="select-checkout-addr" style="margin:0">
                        <span>${esc(a.tag)}</span>
                        ${a.isDefault ? '<small style="background:#e3ecd8;color:#2c5239;padding:1px 6px;border-radius:4px;font-size:9px">Default</small>' : ""}
                      </div>
                      <div style="color:#576b5b;line-height:1.4">${esc(a.line.slice(0, 42))}...</div>
                    </label>
                  `,
                    )
                    .join("")}
                </div>
              </div>`
           : ""
       }
       <div class="form-grid">
         <label class="field">
           <span>Recipient Name</span>
           <input name="name" value="${esc(defAddr?.name || state.user?.name || "")}" autocomplete="name" required maxlength="60">
         </label>
         <label class="field">
           <span>Mobile Number</span>
           <input name="phone" type="tel" inputmode="numeric" pattern="[0-9]{10}" value="${esc(defAddr?.phone || state.user?.phone || "")}" required placeholder="10-digit mobile number">
         </label>
         <label class="field full">
           <span>Delivery Address</span>
           <textarea name="address" autocomplete="street-address" required placeholder="Building, street, area & landmark" maxlength="300">${esc(defAddr?.line || state.user?.address || "")}</textarea>
         </label>
         <label class="field">
           <span>City</span>
           <input name="city" value="${esc(defAddr?.city || state.city)}" required maxlength="60">
         </label>
         <label class="field">
           <span>Postal PIN Code</span>
           <input name="postal" inputmode="numeric" pattern="[0-9]{6}" value="${esc(defAddr?.pincode || "500033")}" required placeholder="6-digit PIN code">
         </label>
       </div>
       <div class="info-banner">${icon("shield")}${state.paymentMode === "test" ? "This is a test environment. Payment is simulated and no money is collected." : state.paymentMode === "disabled" ? "Online payments are not available yet. Please contact the nursery." : "Pay securely using UPI, cards or net banking through Razorpay."}</div>
       <div class="summary-line"><span>${cartCount()} items + delivery</span><strong>${money(totalAmount)}</strong></div>
       <p class="field-note" style="margin-top:8px">By placing an order, you agree to our <a href="javascript:void(0)" data-action="legal" data-id="terms" style="text-decoration:underline">Terms & Conditions</a> and <a href="javascript:void(0)" data-action="legal" data-id="refund" style="text-decoration:underline">Cancellation & Refund Policy</a>.</p>
       <div class="modal-footer">
         <button type="button" class="text-link" data-action="cart">Back to bag</button>
         <button class="btn btn-primary" type="submit" id="pay-button">${state.paymentMode === "test" ? "Complete test checkout" : "Continue to payment"} ${icon("check")}</button>
       </div>
     </form>`,
  );
}
function account() {
  if (!state.user) return authForm("login");
  modalState = { title: "Your account" };
  openModal(
    `<div class="eyebrow">YOUR GREEN SPACE</div><h2>Hello, ${esc(state.user.name.split(" ")[0])}.</h2><p class="modal-intro">Your nursery orders, garden visits and saved addresses.</p><div class="summary-line"><span>Email</span><span>${esc(state.user.email || "Not added")}</span></div><div class="summary-line"><span>Mobile</span><span>${esc(state.user.phone || "Not added")}</span></div><div class="modal-footer"><button class="text-link" data-action="logout">Sign out</button><a href="#${state.user.role === "admin" ? "super-admin" : state.user.role === "partner" ? "partner" : "customer-admin"}" class="btn btn-primary" data-action="close-link">Open your workspace ${icon("arrow")}</a></div>`,
  );
}
function registration() {
  const p = state.user?.role === "partner" ? activePartner() : null;
  if (p && !["Pending", "Rejected"].includes(p.status)) {
    toast(
      "Contact the nursery to change an approved or suspended application.",
    );
    return;
  }
  modalState = {
    title: p ? "Update partner application" : "Apply as a service partner",
    kind: "partner-register",
    applicationUpdate: Boolean(p),
    previousUploadIds: p?.uploads?.map((u) => u.id) || [],
  };
  openModal(
    `<div class="eyebrow">GROW WITH KAUSHIK NURSERY</div><h2>${p ? "Update your application." : "Apply as a service partner."}</h2><form data-form="partner-register"><div class="form-grid"><label class="field"><span>Your name</span><input name="person" value="${esc(p?.person || state.user?.name || "")}" required maxlength="100"></label><label class="field"><span>Business / professional name</span><input name="name" value="${esc(p?.name || "")}" required maxlength="160"></label><label class="field"><span>Mobile number</span><input name="phone" type="tel" pattern="[+0-9]{10,16}" value="${esc(p?.phone || state.user?.phone || "")}" required></label><label class="field"><span>Sign-in email</span><input type="email" value="${esc(state.user?.email || "")}" readonly></label><label class="field"><span>City</span><select name="city">${["Hyderabad", "Bengaluru", "Chennai", "Vijayawada"].map((c) => `<option ${c === (p?.city || state.city) ? "selected" : ""}>${c}</option>`).join("")}</select></label><label class="field"><span>Experience</span><input name="experience" value="${esc(p?.experience || "")}" required maxlength="100"></label><label class="field full"><span>Address</span><input name="address" value="${esc(p?.address || "")}" required maxlength="500"></label><fieldset class="field full"><legend>Services offered</legend>${state.serviceCategories.map((c) => `<label><input type="checkbox" name="categories" value="${esc(c)}" ${p?.categories.includes(c) ? "checked" : ""}> ${esc(c)}</label>`).join("")}</fieldset>${p?.uploads?.length ? `<fieldset class="field full"><legend>Keep existing documents</legend>${p.uploads.map((u) => `<label><input type="checkbox" name="existingUploadIds" value="${u.id}" checked> ${esc(u.original_name)}</label>`).join("")}</fieldset>` : ""}<label class="field full"><span>Identity / business documents</span><input type="file" name="documents" accept="application/pdf,image/jpeg,image/png,image/webp" multiple ${p?.uploads?.length ? "" : "required"}><small>At least one document is required. Only the nursery and your account can access these files.</small></label></div><div class="modal-footer"><small>${p ? "Changes return your application to pending review." : "Nursery approval is required before you receive leads."}</small><button type="submit" class="btn btn-primary">${p ? "Resubmit application" : "Submit application"}</button></div></form>`,
  );
}
async function showAssign(id, append = false, query = "") {
  try {
    const booking = state.leads.find((l) => l.id === id);
    if (!booking) return;
    const previous = modalState || {};
    if (append) query = previous.partnerQuery || "";
    const result = await api.get(
      `/admin/bookings/${encodeURIComponent(id)}/eligible-partners?limit=50&q=${encodeURIComponent(query)}${append && previous.partnerCursor ? "&cursor=" + encodeURIComponent(previous.partnerCursor) : ""}`,
    );
    const partners = append
      ? mergeRecords(previous.eligiblePartners, result.items)
      : result.items;
    modalState = {
      title: "Assign a service partner",
      kind: "assign",
      id,
      eligiblePartners: partners,
      partnerCursor: result.nextCursor,
      partnerQuery: query,
    };
    openModal(
      `<div class="eyebrow">ADMIN ASSIGNMENT CONTROL</div><h2>Choose a matching professional.</h2><p>${esc(booking.serviceName)} · ${esc(booking.city)}</p><form data-form="eligible-search"><label class="field"><span>Find matching partners by name</span><input type="search" name="query" value="${esc(query)}" maxlength="100"></label><button type="submit" class="btn btn-outline btn-small">Find partners</button></form><form data-form="assign"><label class="field"><span>Approved and available partners</span><select name="partner" required><option value="">Choose a professional</option>${partners.map((p) => `<option value="${p.id}" ${p.id === booking.assigned ? "selected" : ""}>${esc(p.name)} · ${esc(p.city)}</option>`).join("")}</select></label>${!partners.length ? "<p>No eligible professionals match this city, category and availability.</p>" : ""}${result.nextCursor ? `<button type="button" class="text-link" data-action="eligible-more" data-id="${id}">Load more matching partners</button>` : ""}<div class="modal-footer"><button type="button" class="text-link" data-action="unassign" data-id="${id}" ${!booking.assigned ? "disabled" : ""}>Remove assignment</button><button type="submit" class="btn btn-primary" ${!partners.length ? "disabled" : ""}>${booking.assigned ? "Reassign" : "Assign"} partner</button></div></form>`,
    );
  } catch (error) {
    toast(error.message);
  }
}
function showJob(id) {
  let l = state.leads.find((l) => l.id === id);
  modalState = { title: "Update assigned job", kind: "job", id };
  openModal(
    `<div class="eyebrow">ASSIGNED SERVICE MANAGEMENT</div><h2>${esc(l.serviceName)}</h2><p class="modal-intro">${esc(l.id)} · ${esc(l.customer)} · ${esc(l.phone || "Contact not added")}</p><div class="summary-line"><span>Visit</span><span>${dateLabel(l.date)} · ${esc(l.time)}</span></div><div class="summary-line"><span>Location</span><span>${esc(l.address)}</span></div><div class="summary-line"><span>Requirements</span><span>${esc(l.description)}</span></div><form data-form="job-update" style="margin-top:23px"><label class="field"><span>Service status</span><select name="status">${[
      l.status,
      {
        "Partner assigned": "Booking confirmed",
        "Booking confirmed": "Service scheduled",
        "Service scheduled": "Service in progress",
        "Service in progress": "Service completed",
      }[l.status],
    ]
      .filter(Boolean)
      .map((s) => `<option ${s === l.status ? "selected" : ""}>${s}</option>`)
      .join(
        "",
      )}</select></label><label class="field" style="margin-top:16px"><span>Progress / completion remarks</span><textarea name="remarks" maxlength="500">${esc(l.remarks || "")}</textarea></label><label class="field" style="margin-top:16px"><span>Completion photographs (optional)</span><input type="file" name="photos" accept="image/*" multiple><p class="field-note">Upload photos to document the completed work.</p></label><div class="modal-footer"><small>Customers see the updated booking status.</small><button class="btn btn-primary">Save progress ${icon("check")}</button></div></form>`,
  );
}
function assetOptions(image) {
  return [
    ...new Set(
      [
        image,
        ...(state.assets || [
          "plant-monstera.jpg",
          "plant-succulent.jpg",
          "plant-indoor.jpg",
          "garden-care.jpg",
          "garden-design.jpg",
          "terracotta-pots.jpg",
        ]),
      ].filter(Boolean),
    ),
  ]
    .map(
      (name) =>
        `<option value="${esc(name)}" ${name === image ? "selected" : ""}>${esc(name.startsWith("/api/") ? "Current uploaded photo" : name)}</option>`,
    )
    .join("");
}
function imageEditor(image) {
  return `<label class="field full"><span>Nursery photo</span><select name="image">${assetOptions(image)}</select></label><label class="field full"><span>Upload a new photo (optional)</span><input type="file" name="photo" accept="image/jpeg,image/png,image/webp"><small>JPEG, PNG or WebP, up to 8 MB. Your current photo stays selected unless changed.</small></label>`;
}
function editProduct(id) {
  const p = state.products.find((p) => p.id === id) || {
    name: "",
    category: state.categories[0] || "",
    stock: 0,
    price: "",
    oldPrice: 0,
    care: "",
    water: "",
    description: "",
    image: "plant-monstera.jpg",
    active: true,
  };
  modalState = { title: "Manage nursery product", kind: "product-edit", id };
  openModal(
    `<div class="eyebrow">NURSERY CATALOG</div><h2>${id === "new" ? "Add a nursery product." : "Edit nursery product."}</h2><form data-form="product-edit"><div class="form-grid"><label class="field full"><span>Product name</span><input name="name" value="${esc(p.name)}" required maxlength="160"></label><label class="field"><span>Category</span><select name="category">${state.categories.map((c) => `<option ${c === p.category ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label><label class="field"><span>Available stock</span><input type="number" name="stock" min="0" max="1000000" value="${p.stock}" required></label><label class="field"><span>Price (₹)</span><input type="number" name="price" min="1" max="1000000" value="${p.price}" required></label><label class="field"><span>Original price (₹)</span><input type="number" name="oldPrice" min="0" max="1000000" value="${p.oldPrice || 0}"></label><label class="field"><span>Light / care information</span><input name="care" value="${esc(p.care)}" maxlength="160"></label><label class="field"><span>Water / additional information</span><input name="water" value="${esc(p.water)}" maxlength="160"></label><label class="field full"><span>Description</span><textarea name="description" required maxlength="5000">${esc(p.description)}</textarea></label>${imageEditor(p.image)}<label class="field"><span>Visible in shop</span><input type="checkbox" name="active" ${p.active !== false ? "checked" : ""}></label></div><div class="modal-footer"><button type="button" class="btn btn-outline" data-action="close">Cancel</button><button type="submit" class="btn btn-primary">Save product</button></div></form>`,
  );
}
function editService(id, draft = null) {
  const service = draft ||
    state.services.find((s) => s.id === id) || {
      name: "",
      category: state.serviceCategories[0] || "",
      description: "",
      image: "garden-design.jpg",
      active: true,
      packages: [{ name: "", price: "", description: "" }],
    };
  modalState = {
    title: "Manage garden service",
    kind: "service-edit",
    id,
    pendingPhoto: draft?.pendingPhoto,
  };
  openModal(
    `<div class="eyebrow">SERVICE CATALOG</div><h2>${id === "new" ? "Add a garden service." : "Edit garden service."}</h2><form data-form="service-edit"><div class="form-grid"><label class="field full"><span>Service name</span><input name="name" value="${esc(service.name)}" required maxlength="160"></label><label class="field full"><span>Category</span><select name="category">${state.serviceCategories.map((c) => `<option ${c === service.category ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label><label class="field full"><span>Description</span><textarea name="description" required maxlength="5000">${esc(service.description)}</textarea></label>${imageEditor(service.image)}<label class="field"><span>Visible for bookings</span><input type="checkbox" name="active" ${service.active !== false && service.active !== 0 ? "checked" : ""}></label></div>${modalState.pendingPhoto ? `<p class="field-note">Selected photo: ${esc(modalState.pendingPhoto.name)}</p>` : ""}<h3>Packages</h3><p class="field-note">Manage one to ten packages. Existing package IDs and prices are preserved.</p>${service.packages.map((p, index) => `<fieldset class="package-editor"><legend>Package ${index + 1}</legend><input type="hidden" name="packageId" value="${esc(p.id || "")}"><div class="form-grid"><label class="field"><span>Package ${index + 1} name</span><input name="packageName" value="${esc(p.name)}" required maxlength="160"></label><label class="field"><span>Package ${index + 1} price (₹)</span><input type="number" name="packagePrice" min="1" max="1000000" value="${p.price}" required></label><label class="field full"><span>Package ${index + 1} description</span><textarea name="packageDescription" maxlength="2000">${esc(p.description || "")}</textarea></label></div>${service.packages.length > 1 ? `<button type="button" class="text-link" data-action="service-package-remove" data-id="${index}">Remove package ${index + 1}</button>` : ""}</fieldset>`).join("")}<div class="modal-footer"><button type="button" class="btn btn-outline" data-action="service-package-add" ${service.packages.length >= 10 ? "disabled" : ""}>Add package</button><button type="submit" class="btn btn-primary">Save service</button></div></form>`,
  );
}
function changeServicePackages(action, index) {
  const form = document.querySelector('[data-form="service-edit"]'),
    fd = new FormData(form),
    draft = Object.fromEntries(fd);
  draft.active = fd.has("active");
  draft.pendingPhoto = form.elements.photo.files[0] || modalState.pendingPhoto;
  draft.packages = fd.getAll("packageName").map((name, i) => ({
    id: fd.getAll("packageId")[i],
    name,
    price: fd.getAll("packagePrice")[i],
    description: fd.getAll("packageDescription")[i],
  }));
  if (action === "service-package-add" && draft.packages.length < 10)
    draft.packages.push({ name: "", price: "", description: "" });
  if (action === "service-package-remove" && draft.packages.length > 1)
    draft.packages.splice(Number(index), 1);
  editService(modalState.id, draft);
}
async function searchAdminUsers(query) {
  const result = await api.get(
    "/admin/users?limit=25&q=" + encodeURIComponent(query.trim()),
  );
  state.adminUserQuery = query.trim();
  state.users = result.items;
  state.cursors.users = result.nextCursor;
  render();
}
function passwordForm() {
  modalState = { title: "Account security" };
  openModal(
    `<div class="eyebrow">ACCOUNT SECURITY</div><h2>Change your password.</h2><form data-form="change-password"><label class="field"><span>Current password</span><input type="password" name="currentPassword" autocomplete="current-password" required maxlength="128"></label><label class="field"><span>New password</span><input type="password" name="password" minlength="12" maxlength="128" autocomplete="new-password" required></label><label class="field"><span>Confirm new password</span><input type="password" name="confirmation" minlength="12" maxlength="128" autocomplete="new-password" required></label><p class="field-note">Your other sessions will be signed out after this change.</p><div class="modal-footer"><button type="submit" class="btn btn-primary">Update password</button></div></form>`,
  );
}
function refundConfirmation(id) {
  const p = state.payments.find((p) => p.id === id);
  if (!p) return;
  modalState = { title: "Confirm full refund" };
  openModal(
    `<div class="eyebrow">PAYMENT RECONCILIATION</div><h2>Request a full refund?</h2><p>${esc(p.order_id || p.booking_id)}</p><div class="summary-line"><span>Amount</span><strong>${money(p.amount_paise / 100)}</strong></div><p>The worker will submit or reconcile this refund with the original payment provider.</p><div class="modal-footer"><button type="button" class="btn btn-outline" data-action="close">Keep payment</button><button type="button" class="btn btn-primary" data-action="confirm-refund" data-id="${p.id}">Request full refund</button></div>`,
  );
}
function exportCSV(type) {
  api.download(type).catch((error) => toast(error.message));
}
document.addEventListener("click", (event) => {
  if (event.target.closest(".skip-content")) {
    event.preventDefault();
    const main = $("main");
    if (main) {
      main.tabIndex = -1;
      main.focus();
      main.scrollIntoView({ block: "start" });
    }
    return;
  }
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
    closeMobileNavigation();
    return;
  }
  const a = el.dataset.action,
    id = el.dataset.id;
  if (a !== "close-overlay") event.preventDefault();
  switch (a) {
    case "browse-category":
      shopCategory = id;
      shopQuery = "";
      favoritesOnly = false;
      shopSort = "featured";
      if (route === "shop") render(true);
      else location.hash = "shop";
      break;
    case "workspace": {
      let menu = $(".workspace-menu");
      menu.classList.toggle("hidden");
      el.setAttribute("aria-expanded", !menu.classList.contains("hidden"));
      break;
    }
    case "mobile-nav":
      break;
    case "mobile-nav-close":
      closeMobileNavigation(true);
      break;
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
      el.setAttribute(
        "aria-label",
        `${state.favorites.includes(id) ? "Unsave" : "Save"} ${product(id).name}`,
      );
      toast(
        state.favorites.includes(id)
          ? "Saved for another little green moment."
          : "Removed from your saved plants.",
      );
      if (route === "shop" && favoritesOnly) {
        $("#catalog-results").innerHTML = filteredProducts();
        $("#catalog-count").textContent =
          `${catalogProducts().length} products found`;
      }
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
    case "submit-booking":
      break;
    case "orders-tab":
      orderTab = id;
      render();
      break;
    case "account":
      account();
      break;
    case "logout":
      break;
    case "location":
      modalState = { title: "Choose your city" };
      openModal(
        `<div class="eyebrow">GROWING NEAR YOU</div><h2>Where’s your little green space?</h2><p class="modal-intro">Choose your city for service matching.</p><form data-form="location"><label class="field"><span>Your city</span><select name="city">${["Hyderabad", "Bengaluru", "Chennai", "Vijayawada"].map((c) => `<option ${c === state.city ? "selected" : ""}>${c}</option>`).join("")}</select></label><div class="modal-footer"><small>Partner availability varies by city.</small><button class="btn btn-primary">Save city ${icon("check")}</button></div></form>`,
      );
      break;
    case "workspace-tab":
      workspaceTab = id;
      render();
      break;
    case "super-admin-lock":
      break;
    case "partner-register":
      registration();
      break;
    case "partner-status":
      break;
    case "accept-lead":
      break;
    case "decline-lead":
      break;
    case "job-update":
      showJob(id);
      break;
    case "assign":
      showAssign(id);
      break;
    case "unassign":
      break;
    case "cancel-booking":
      modalState = { title: "Cancel service request", id };
      openModal(
        `<div class="eyebrow">MANAGE YOUR REQUEST</div><h2>Cancel this garden request?</h2><p class="modal-intro">${esc(id)} will close for all partners. This closes the request for all partners.</p><div class="modal-footer"><button class="btn btn-outline" data-action="close">Keep request</button><button class="btn btn-primary" data-action="confirm-cancel" data-id="${id}">Cancel request</button></div>`,
      );
      break;
    case "confirm-cancel":
      break;
    case "payment":
      break;
    case "product-edit":
      editProduct(id);
      break;
    case "service-edit":
      editService(id);
      break;
    case "export":
      exportCSV(id);
      break;
    case "review": {
      let l = state.leads.find((l) => l.id === id);
      modalState = { title: "Review your service", kind: "review", id };
      openModal(
        `<div class="eyebrow">A LITTLE FEEDBACK HELPS US GROW</div><h2>How did your garden visit go?</h2><p class="modal-intro">${esc(l.serviceName)}</p><form data-form="review"><label class="field"><span>Rating</span><select name="rating">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}" ${l.review?.rating === n ? "selected" : ""}>${n} ${n === 1 ? "star" : "stars"}</option>`).join("")}</select></label><label class="field" style="margin-top:18px"><span>Your feedback</span><textarea name="text" required maxlength="500">${esc(l.review?.text || "")}</textarea></label><div class="modal-footer"><small>Your feedback is saved with this service booking.</small><button class="btn btn-primary">Save review ${icon("star")}</button></div></form>`,
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
        `<div class="eyebrow">YOUR GREEN WORLD, IN YOUR POCKET</div><h2>Made for a greener everyday.</h2><p class="modal-intro">The proposed platform includes a customer Android app and a dedicated Android app for service professionals.</p><div class="package-grid"><a class="package" href="#home" data-action="close-link"><h3>Customer experience</h3><p>Explore services, buy nursery products and manage bookings.</p>${icon("leaf")}</a><a class="package" href="#partner" data-action="close-link"><h3>Partner experience</h3><p>Receive matching leads, accept assignments and manage jobs.</p>${icon("briefcase")}</a></div><p class="field-note">These responsive screens preview the proposed app flows. Android binaries and Google Play listings are separate deliverables.</p>`,
      );
      break;
    case "legal": {
      const pol = policies[id] || policies.privacy;
      modalState = {
        title: pol.title,
      };
      openModal(
        `<div class="eyebrow">CUSTOMER PROTECTION & COMPLIANCE</div><h2>${esc(pol.title)}</h2><p class="modal-intro">${esc(pol.subtitle)}</p><p class="field-note" style="margin-bottom:16px">Last updated: ${esc(pol.lastUpdated)} · Kaushik Nursery</p><div class="policy-body" style="font-size:14px;line-height:1.7;color:var(--forest-800,#24392b);max-height:55vh;overflow-y:auto;padding-right:8px">${
          id === "contact"
            ? contactDetails()
            : esc(pol.content)
                .split("\n\n")
                .map((p) => `<p>${p}</p>`)
                .join("")
        }</div><div class="modal-footer" style="margin-top:20px"><small>Draft operational information · Pending nursery approval.</small><button class="btn btn-primary" data-action="close">Understood ${icon("check")}</button></div>`,
      );
      break;
    }
    case "address-add":
      showAddressModal();
      break;
    case "address-edit":
      showAddressModal(id);
      break;
    case "address-delete":
      break;
    case "address-set-default":
      break;
  }
});
document.addEventListener("input", (event) => {
  if (event.target.id === "product-search") {
    shopQuery = event.target.value;
    $("#catalog-results").innerHTML = filteredProducts();
    $("#catalog-count").textContent =
      `${catalogProducts().length} products shown`;
    clearTimeout(catalogTimer);
    catalogTimer = setTimeout(() => fetchCatalog(), 200);
  }
});
document.addEventListener("change", (event) => {
  if (event.target.id === "product-sort") {
    shopSort = event.target.value;
    $("#catalog-results").innerHTML = filteredProducts();
    fetchCatalog();
  }
  if (event.target.name === "selected_address_id") {
    const selId = event.target.value;
    const addr = state.user?.addresses?.find((a) => a.id === selId);
    if (addr) {
      const form = event.target.closest("form");
      if (form) {
        if (form.elements.name) form.elements.name.value = addr.name;
        if (form.elements.phone) form.elements.phone.value = addr.phone;
        if (form.elements.address) form.elements.address.value = addr.line;
        if (form.elements.city) form.elements.city.value = addr.city;
        if (form.elements.postal)
          form.elements.postal.value = addr.pincode || "500033";
      }
      toast(`Selected address: ${addr.tag}`);
    }
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
  const f = Object.fromEntries(new FormData(form));
  if (form.dataset.form === "catalog-search") {
    shopQuery = f.query.trim();
    shopCategory = "All plants";
    favoritesOnly = false;
    if (route === "shop") render(true);
    else location.hash = "shop";
  }
  if (form.dataset.form === "location") {
    state.city = f.city;
    persist();
    closeModal();
    render();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal();
    $(".workspace-menu")?.classList.add("hidden");
    closeMobileNavigation(true);
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
installLiveController({
  state: () => state,
  modal: () => modalState,
  refresh: refreshState,
  refreshAccount,
  passwordForm,
  refundConfirmation,
  showAssign,
  changeServicePackages,
  changeBannerDraft: (action, index) => {
    changeBannerDraft(state, action, index);
    render();
  },
  saveBannerDraft: (form) => saveBannerDraft(state, form),
  searchAdminUsers,
  render,
  toast,
  closeModal,
  openModal,
  account,
  authForm,
  otpForm,
  showBooking,
  showCart,
  showNotifications,
  categoryForm,
  loadMore,
  setOrderTab: (value) => {
    orderTab = value;
  },
});
try {
  await refreshState();
} catch (error) {
  backendError = error.message;
}
navigate();
endIntro();

function accessPanel(title, allowLogin = true) {
  return `<main class="container" style="max-width:650px;padding-top:65px;padding-bottom:65px"><div class="panel"><div class="eyebrow">YOUR KAUSHIK NURSERY ACCOUNT</div><h1 style="font-size:34px">${esc(title)}</h1><p>${allowLogin ? "Sign in to manage your orders, garden bookings and account details." : "Your account does not have access to this workspace."}</p>${allowLogin ? '<button class="btn btn-primary" data-action="account">Sign in</button>' : '<a href="#home" class="btn btn-outline">Back to the nursery</a>'}</div></main>`;
}
function authForm(kind = "login", resetToken = "") {
  modalState = {
    title: kind === "register" ? "Create your account" : "Your account",
  };
  const fields =
    kind === "otp"
      ? `<label class="field"><span>Mobile number</span><input type="tel" name="phone" pattern="[0-9]{10}" autocomplete="tel" required></label>`
      : kind === "forgot"
        ? `<label class="field"><span>Email address</span><input type="email" name="email" autocomplete="email" required></label>`
        : kind === "reset"
          ? `<input type="hidden" name="token" value="${esc(resetToken)}"><label class="field"><span>New password</span><input type="password" name="password" minlength="12" maxlength="128" autocomplete="new-password" required></label>`
          : `<div class="form-grid">${kind === "register" ? '<label class="field full"><span>Your name</span><input name="name" required maxlength="100" autocomplete="name"></label>' : ""}<label class="field full"><span>Email address</span><input type="email" name="email" required autocomplete="email"></label><label class="field full"><span>Password</span><input type="password" name="password" minlength="${kind === "register" ? "12" : "1"}" maxlength="128" autocomplete="${kind === "register" ? "new-password" : "current-password"}" required></label></div>`;
  const form = {
    otp: "auth-otp-request",
    login: "auth-login",
    register: "auth-register",
    forgot: "auth-forgot",
    reset: "auth-reset",
  }[kind];
  openModal(
    `<div class="eyebrow">WELCOME TO A GREENER EVERYDAY</div><h2>${{ otp: "Sign in with your mobile.", login: "Sign in to your green space.", register: "Let’s grow together.", forgot: "Reset your password.", reset: "Choose a new password." }[kind]}</h2><p class="modal-intro">${kind === "register" || kind === "reset" ? "Use a unique password with at least 12 characters." : "Your orders, garden bookings and nursery favourites, all in one place."}</p><form data-form="${form}">${fields}<div class="modal-footer"><button type="button" class="text-link" data-action="${kind === "login" ? "auth-register" : "auth-login"}">${kind === "login" ? "Create an account" : "Back to sign in"}</button><button class="btn btn-primary" type="submit">${{ otp: "Send verification code", login: "Sign in", register: "Create account", forgot: "Send reset email", reset: "Save new password" }[kind]} ${icon("arrow")}</button></div></form>${kind === "login" ? '<button class="text-link" data-action="forgot-password" style="margin-top:16px">Forgot password?</button>' : ""}${kind === "login" && state.smsEnabled ? '<button class="text-link" data-action="auth-otp" style="margin:16px">Use mobile verification</button>' : ""}`,
  );
}
function otpForm(challengeId) {
  openModal(
    `<div class="eyebrow">VERIFY YOUR MOBILE</div><h2>Check your messages.</h2><form data-form="auth-otp-verify"><input type="hidden" name="challengeId" value="${esc(challengeId)}"><label class="field"><span>Six-digit verification code</span><input name="code" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" required></label><div class="modal-footer"><button class="btn btn-primary" type="submit">Verify & sign in</button></div></form>`,
  );
}
function showNotifications() {
  modalState = { title: "Your notifications" };
  openModal(
    `<div class="eyebrow">FROM YOUR NURSERY</div><h2>A little update.</h2>${state.notifications.length ? state.notifications.map((n) => `<div class="notification-item"><h3>${esc(n.title)}</h3><p>${esc(n.message)}</p>${!n.read_at ? `<button class="text-link" data-action="notification-read" data-id="${n.seq}">Mark as read</button>` : ""}</div>`).join("") : "<p>No notifications yet.</p>"}${state.cursors.notifications ? '<button class="btn btn-outline" data-action="load-more" data-id="notifications">Load earlier notifications</button>' : ""}`,
  );
}
function categoryForm(kind) {
  modalState = { title: "Add category" };
  openModal(
    `<div class="eyebrow">NURSERY CATEGORIES</div><h2>Add a ${kind === "product" ? "product" : "service"} category.</h2><form data-form="${kind === "product" ? "category-create" : "service-category-create"}"><label class="field"><span>Category name</span><input name="name" maxlength="100" required></label><div class="modal-footer"><button type="submit" class="btn btn-primary">Save category</button></div></form>`,
  );
}
function mergeRecords(first = [], second = []) {
  return [
    ...new Map(
      [...first, ...second].map((item) => [item.id || item.seq, item]),
    ).values(),
  ];
}
async function refreshAccount() {
  const account = await api.get("/account");
  state.user = account.user;
  state.cart = account.cart;
  state.favorites = account.favorites;
  state.products = mergeRecords(state.products, account.cartProducts);
  const wishlist = await api.get("/wishlist/products?limit=25&page=1");
  state.wishlistProducts = wishlist.items;
  state.wishlistMore = wishlist.hasMore;
  state.wishlistPage = 1;
  catalogSignature = "";
  persist();
}
async function refreshState() {
  const previousUser = state.user,
    boot = await api.get("/bootstrap");
  api.setSession(boot);
  const next = {
    ...state,
    products: boot.products,
    services: boot.services,
    liveServiceIds: boot.services.map((s) => s.id),
    user: boot.user,
    paymentMode: boot.paymentMode,
    smsEnabled: boot.smsEnabled,
    business: boot.business,
    hero: boot.hero,
    heroDraft: null,
    categories: boot.categories.map((c) => c.name),
    serviceCategories: boot.serviceCategories.map((c) => c.name),
    orders: [],
    myOrders: [],
    myBookings: [],
    leads: [],
    partners: [],
    users: [],
    payments: [],
    broadcasts: [],
    notifications: [],
    wishlistProducts: [],
    cursors: {},
    stats: {},
    customerStats: {},
    adminJobs: [],
    catalogResults: null,
  };
  if (!next.user) {
    if (previousUser) {
      next.cart = [];
      next.favorites = [];
    }
    Object.assign(state, next);
    catalogSignature = "";
    backendError = "";
    persist();
    return;
  }
  try {
    const [account, orders, bookings, notifications, overview, wishlist] =
      await Promise.all([
        api.get("/account"),
        api.get("/orders?limit=25"),
        api.get("/bookings?limit=25"),
        api.get("/notifications?limit=25"),
        api.get("/account/overview"),
        api.get("/wishlist/products?limit=25&page=1"),
      ]);
    Object.assign(next, account, {
      products: mergeRecords(boot.products, account.cartProducts),
      myOrders: orders.items,
      myBookings: bookings.items,
      orders: orders.items,
      leads: bookings.items,
      notifications: notifications.items,
      unreadCount: notifications.unreadCount,
      customerStats: overview,
      wishlistProducts: wishlist.items,
      wishlistMore: wishlist.hasMore,
      wishlistPage: 1,
    });
    Object.assign(next.cursors, {
      myOrders: orders.nextCursor,
      myBookings: bookings.nextCursor,
      notifications: notifications.nextCursor,
    });
    if (next.user.role === "partner") {
      const [profile, leads, jobs] = await Promise.all([
        api.get("/partner/profile"),
        api.get("/partner/leads?limit=25"),
        api.get("/partner/jobs?limit=25"),
      ]);
      next.partners = profile.partner ? [profile.partner] : [];
      next.leads = mergeRecords(leads.items, jobs.items);
      next.cursors.leads = leads.nextCursor;
      next.cursors.jobs = jobs.nextCursor;
    }
    if (next.user.role === "admin") {
      const [
        users,
        partners,
        allOrders,
        allBookings,
        products,
        payments,
        settings,
        stats,
        services,
        broadcasts,
        assets,
        categories,
        serviceCategories,
        jobs,
        hero,
      ] = await Promise.all([
        api.get("/admin/users?limit=25"),
        api.get("/admin/partners?limit=25"),
        api.get("/admin/orders?limit=25"),
        api.get("/admin/bookings?limit=25"),
        api.get("/admin/products?limit=100"),
        api.get("/admin/payments?limit=25"),
        api.get("/admin/settings"),
        api.get("/admin/overview"),
        api.get("/admin/services"),
        api.get("/admin/notifications"),
        api.get("/admin/assets"),
        api.get("/admin/categories"),
        api.get("/admin/service-categories"),
        api.get("/admin/jobs?limit=25"),
        api.get("/admin/hero"),
      ]);
      Object.assign(next, {
        users: users.items,
        partners: partners.items,
        orders: allOrders.items,
        leads: allBookings.items,
        products: products.items,
        payments: payments.items,
        maxPartners: settings.maxPartners,
        rotation: settings.rotation,
        stats,
        services: services.items,
        broadcasts: broadcasts.items,
        assets: assets.items,
        adminCategories: categories.items,
        adminServiceCategories: serviceCategories.items,
        adminJobs: jobs.items,
        adminHero: hero,
        adminUserQuery: "",
      });
      Object.assign(next.cursors, {
        users: users.nextCursor,
        partners: partners.nextCursor,
        orders: allOrders.nextCursor,
        leads: allBookings.nextCursor,
        products: products.nextCursor,
        payments: payments.nextCursor,
      });
    }
    Object.assign(state, next);
    catalogSignature = "";
    backendError = "";
    persist();
  } catch (error) {
    if (error.status === 401) {
      state.user = null;
      state.myOrders = [];
      state.myBookings = [];
      state.orders = [];
      state.leads = [];
      api.setSession({});
    }
    throw error;
  }
}
async function fetchCatalog(append = false) {
  if (route !== "shop") return;
  const signature = JSON.stringify({
    category: shopCategory,
    q: shopQuery,
    sort: shopSort,
    favoritesOnly,
    favorites: state.favorites,
  });
  if (!append && signature === catalogSignature) return;
  catalogSignature = signature;
  const page = append ? (state.catalogPage || 1) + 1 : 1;
  if (favoritesOnly && !state.user) {
    state.catalogResults = state.products.filter((p) =>
      state.favorites.includes(p.id),
    );
    state.catalogMore = false;
    updateCatalog();
    return;
  }
  try {
    const query = new URLSearchParams({
      category: shopCategory === "All plants" ? "" : shopCategory,
      q: shopQuery,
      sort: shopSort,
      limit: "25",
      page: String(page),
    });
    const result = await api.get(
      favoritesOnly ? `/wishlist/products?${query}` : `/products?${query}`,
    );
    if (signature !== catalogSignature || route !== "shop") return;
    state.catalogResults = append
      ? [...state.catalogResults, ...result.items]
      : result.items;
    state.catalogPage = page;
    state.catalogMore = result.hasMore;
    updateCatalog();
  } catch (error) {
    toast(error.message);
  }
}
function updateCatalog() {
  const results = $("#catalog-results");
  if (results) results.innerHTML = filteredProducts();
  const count = $("#catalog-count");
  if (count)
    count.textContent = `${catalogProducts().length} products shown${state.catalogMore ? " · more available" : ""}`;
  addPagination();
}
async function loadMore(kind) {
  if (kind === "catalog") return fetchCatalog(true);
  if (kind === "wishlist") {
    const result = await api.get(
      `/wishlist/products?limit=25&page=${(state.wishlistPage || 1) + 1}`,
    );
    state.wishlistProducts = mergeRecords(state.wishlistProducts, result.items);
    state.wishlistPage++;
    state.wishlistMore = result.hasMore;
    return;
  }
  const admin = state.user?.role === "admin",
    partner = state.user?.role === "partner";
  const paths = {
    users: "/admin/users",
    partners: "/admin/partners",
    products: "/admin/products",
    payments: "/admin/payments",
    orders: "/admin/orders",
    myOrders: "/orders",
    myBookings: "/bookings",
    notifications: "/notifications",
    bookings: "/bookings",
    leads: admin ? "/admin/bookings" : "/partner/leads",
    jobs: "/partner/jobs",
  };
  if (!paths[kind] || !state.cursors[kind]) return;
  const result = await api.get(
    `${paths[kind]}?limit=25&cursor=${encodeURIComponent(state.cursors[kind])}${kind === "users" && state.adminUserQuery ? "&q=" + encodeURIComponent(state.adminUserQuery) : ""}`,
  );
  const key = ["bookings", "leads", "jobs"].includes(kind) ? "leads" : kind;
  state[key] = [
    ...new Map(
      [...state[key], ...result.items].map((item) => [
        item.id || item.seq,
        item,
      ]),
    ).values(),
  ];
  state.cursors[kind] = result.nextCursor;
}
function addPagination() {
  document.querySelectorAll(".pagination-footer").forEach((el) => el.remove());
  const main = $("main");
  if (!main) return;
  let kinds = [];
  if (route === "shop" && state.catalogMore) kinds = ["catalog"];
  if (route === "orders")
    kinds = [orderTab === "products" ? "myOrders" : "myBookings"];
  if (route === "customer-admin")
    kinds =
      workspaceTab === "orders"
        ? ["myOrders"]
        : workspaceTab === "bookings"
          ? ["myBookings"]
          : workspaceTab === "saved"
            ? ["wishlist"]
            : [];
  if (["admin", "super-admin"].includes(route))
    kinds =
      {
        users: ["users"],
        partners: ["partners"],
        products: ["products", "orders"],
        leads: ["leads"],
        payments: ["payments"],
      }[workspaceTab] || [];
  if (route === "partner")
    kinds =
      workspaceTab === "leads"
        ? ["leads"]
        : workspaceTab === "jobs"
          ? ["jobs"]
          : [];
  const buttons = kinds
    .filter((kind) =>
      kind === "catalog"
        ? state.catalogMore
        : kind === "wishlist"
          ? state.wishlistMore
          : state.cursors[kind],
    )
    .map(
      (kind) =>
        `<button class="btn btn-outline" data-action="load-more" data-id="${kind}">Load more ${{ catalog: "products", myOrders: "orders", myBookings: "bookings", wishlist: "saved plants" }[kind] || kind}</button>`,
    )
    .join("");
  if (buttons)
    main.insertAdjacentHTML(
      "beforeend",
      `<div class="pagination-footer">${buttons}</div>`,
    );
}

function fileLinks(uploads = []) {
  return uploads
    .map(
      (u) =>
        `<a href="/api/uploads/${encodeURIComponent(u.id)}/content" target="_blank" rel="noopener">${esc(u.original_name)}</a>`,
    )
    .join(" · ");
}

function categoryControls(kind) {
  const list =
    kind === "product" ? state.adminCategories : state.adminServiceCategories;
  return `<div class="panel"><h2>${kind === "product" ? "Product" : "Service"} category visibility</h2>${table(
    ["Category", "Status", "Manage"],
    (list || []).map(
      (c) =>
        `<tr><td>${esc(c.name)}</td><td>${c.active ? "Visible" : "Hidden"}</td><td><button class="btn btn-outline btn-small" data-action="category-toggle" data-kind="${kind}" data-id="${esc(kind === "product" ? c.id : c.name)}" data-active="${!Boolean(c.active)}">${c.active ? "Hide" : "Show"} ${esc(c.name)}</button></td></tr>`,
    ),
  )}</div>`;
}

function contactDetails() {
  const b = state.business || {};
  return `<h3>${esc(b.name || "Kaushik Nursery")}</h3>${b.email ? `<p>Email: <a href="mailto:${esc(b.email)}">${esc(b.email)}</a></p>` : ""}${b.phone ? `<p>Phone: <a href="tel:${esc(b.phone)}">${esc(b.phone)}</a></p>` : ""}${b.address ? `<p>${esc(b.address).replace(/\n/g, "<br>")}</p>` : ""}${!b.email && !b.phone && !b.address ? "<p>Verified nursery support details have not yet been published.</p>" : ""}`;
}
