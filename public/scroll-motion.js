import Lenis from "./vendor/lenis.mjs";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
// One scroll engine for the app: route renders must not add animation loops.
const scrolling = new Lenis({
  autoRaf: true,
  lerp: 0.085,
  smoothWheel: true,
  syncTouch: false,
  respectReducedMotion: true,
  // These panels keep their own native scrolling, including horizontal tables.
  prevent: (node) =>
    node.matches(
      "#modal-root, .mobile-nav-panel, .main-nav, .workspace-sidebar, .table-wrap, [data-native-scroll]",
    ),
});

export function syncScrollLock() {
  if (document.body.classList.contains("modal-open")) scrolling.stop();
  else scrolling.start();
}

export function refreshScrollMetrics(reset = false) {
  scrolling.resize();
  if (reset) scrolling.scrollTo(0, { immediate: true, force: true });
}

export function scrollPageTo(target) {
  if (!target) return;
  scrolling.resize();
  const header = document.querySelector(".store-chrome");
  const offset = Math.max(0, header?.getBoundingClientRect().bottom || 0) + 12;
  scrolling.scrollTo(target, {
    offset: -offset,
    duration: 1.1,
    lerp: 0,
    easing: (t) => 1 - Math.pow(1 - t, 4),
  });
}

export function mountScrollMotion() {
  const main = document.querySelector("main");
  if (!main || reducedMotion.matches) return () => {};
  const targets = main.querySelectorAll(
    ".section-title, .collection-card, .service-card, .product-card, .inspiration-card, .growing-steps > div, .android-banner, .newsletter",
  );
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in-view");
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.06, rootMargin: "0px 0px -20px 0px" },
  );
  // Read positions together before applying styles to avoid repeated layouts.
  const positions = [...targets].map((target) => [
    target,
    target.getBoundingClientRect().top,
  ]);
  for (const [target, top] of positions) {
    // Keep the first screen and already viewed content immediately available.
    if (top < innerHeight) {
      target.classList.add("is-in-view");
      continue;
    }
    target.classList.add("scroll-reveal");
    const siblings = [...target.parentElement.children];
    target.style.setProperty(
      "--reveal-delay",
      `${Math.min(siblings.indexOf(target), 3) * 45}ms`,
    );
    observer.observe(target);
  }
  const revealAll = () => {
    if (!reducedMotion.matches) return;
    targets.forEach((target) => target.classList.add("is-in-view"));
    observer.disconnect();
  };
  const revealFocus = (event) => {
    const target = event.target.closest(".scroll-reveal");
    if (target) {
      target.classList.add("is-in-view");
      observer.unobserve(target);
    }
  };
  reducedMotion.addEventListener("change", revealAll);
  main.addEventListener("focusin", revealFocus);
  return () => {
    observer.disconnect();
    reducedMotion.removeEventListener("change", revealAll);
    main.removeEventListener("focusin", revealFocus);
  };
}
