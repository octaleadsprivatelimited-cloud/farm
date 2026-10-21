import "./vendor/motion.js";
const { animate, stagger } = window.Motion;
let closeCurrentMenu = () => {};
export function closeMobileNavigation(focus = false) {
  closeCurrentMenu(focus);
}
export function mountStorefrontInteractions() {
  const chrome = document.querySelector(".store-chrome");
  if (!chrome) return () => {};
  const reduced = matchMedia("(prefers-reduced-motion: reduce)"),
    mobile = matchMedia("(max-width: 900px)");
  const menu = chrome.querySelector(".mobile-nav-panel"),
    toggle = chrome.querySelector('[data-action="mobile-nav"]'),
    scrim = chrome.querySelector(".mobile-nav-scrim"),
    announcement = chrome.querySelector(".store-announcement");
  let opened = false,
    epoch = 0,
    controls = [],
    disposed = false;
  const stop = () => {
    controls.forEach((c) => c.stop());
    controls = [];
  };
  const motion = (target, values, options = {}) => {
    const c = animate(target, values, {
      ...options,
      ...(reduced.matches ? { duration: 0, delay: 0 } : {}),
    });
    controls.push(c);
    return c;
  };
  const measure = () => {
    document.documentElement.style.setProperty(
      "--store-topbar-height",
      `${announcement.offsetTop + announcement.offsetHeight}px`,
    );
    document.documentElement.style.setProperty(
      "--store-header-height",
      `${Math.max(0, chrome.getBoundingClientRect().bottom)}px`,
    );
  };
  const resize = new ResizeObserver(measure);
  resize.observe(chrome);
  measure();
  let lastScroll = window.scrollY,
    directionDistance = 0;
  const scroll = () => {
    const y = window.scrollY,
      delta = y - lastScroll;
    lastScroll = y;
    chrome.classList.toggle("is-scrolled", y > 8);
    directionDistance =
      Math.sign(delta) === Math.sign(directionDistance)
        ? directionDistance + delta
        : delta;
    const hide = y > 100 && directionDistance > 12;
    const reveal = y < 40 || directionDistance < -8;
    if (hide && !opened && !announcement.contains(document.activeElement)) {
      chrome.classList.add("topbar-hidden");
      announcement.inert = true;
      announcement.setAttribute("aria-hidden", "true");
    } else if (reveal) {
      chrome.classList.remove("topbar-hidden");
      announcement.inert = false;
      announcement.removeAttribute("aria-hidden");
    }
  };
  const transitioned = (event) => {
    if (event.target === chrome && event.propertyName === "top") measure();
  };
  chrome.addEventListener("transitionend", transitioned);
  window.addEventListener("scroll", scroll, { passive: true });
  scroll();
  function setMenu(next, focus = false) {
    if (opened === next) return;
    opened = next;
    const version = ++epoch;
    stop();
    toggle.setAttribute("aria-expanded", String(next));
    toggle.setAttribute(
      "aria-label",
      next ? "Close navigation" : "Open navigation",
    );
    const lines = toggle.querySelectorAll(".menu-toggle-lines span");
    motion(
      lines[0],
      { y: next ? 6 : 0, rotate: next ? 45 : 0 },
      { duration: 0.24 },
    );
    motion(lines[1], { opacity: next ? 0 : 1 }, { duration: 0.15 });
    motion(
      lines[2],
      { y: next ? -6 : 0, rotate: next ? -45 : 0 },
      { duration: 0.24 },
    );
    menu.inert = !next;
    if (next) {
      measure();
      menu.hidden = false;
      scrim.hidden = false;
      const height = Math.min(
        menu.scrollHeight,
        window.innerHeight - chrome.getBoundingClientRect().bottom - 12,
      );
      motion(
        menu,
        { height: [0, Math.max(height, 100)], opacity: [0, 1], y: [-10, 0] },
        { type: "spring", bounce: 0.12, duration: 0.42 },
      );
      motion(
        menu.querySelectorAll(".mobile-nav-item"),
        { opacity: [0, 1], y: [-7, 0] },
        { duration: 0.24, delay: stagger(0.025, { startDelay: 0.06 }) },
      );
      motion(scrim, { opacity: [0, 1] }, { duration: 0.2 });
    } else {
      const closing = motion(
        menu,
        { height: 0, opacity: 0, y: -8 },
        { duration: 0.2, ease: "easeInOut" },
      );
      motion(scrim, { opacity: 0 }, { duration: 0.18 });
      Promise.resolve(closing).then(() => {
        if (!disposed && epoch === version) {
          menu.hidden = true;
          scrim.hidden = true;
        }
      });
      if (focus) toggle.focus();
    }
  }
  closeCurrentMenu = (focus) => setMenu(false, focus);
  const toggleMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu(!opened);
  };
  const dismiss = () => setMenu(false, true);
  const choose = (event) => {
    if (event.target.closest("a,button[data-action]")) setMenu(false);
  };
  const key = (event) => {
    if (event.key === "Escape" && opened) {
      event.preventDefault();
      setMenu(false, true);
    }
  };
  const breakpoint = () => {
    setMenu(false);
    measure();
  };
  const outside = (event) => {
    if (opened && !chrome.contains(event.target)) setMenu(false);
  };
  const focusOut = (event) => {
    if (opened && event.relatedTarget && !chrome.contains(event.relatedTarget))
      setMenu(false);
  };
  toggle.addEventListener("click", toggleMenu);
  scrim.addEventListener("click", dismiss);
  menu.addEventListener("click", choose);
  document.addEventListener("keydown", key);
  document.addEventListener("click", outside);
  chrome.addEventListener("focusout", focusOut);
  mobile.addEventListener("change", breakpoint);
  const cleanHero = carousel(
    document.querySelector("[data-hero-carousel]"),
    reduced,
  );
  return () => {
    disposed = true;
    stop();
    resize.disconnect();
    chrome.removeEventListener("transitionend", transitioned);
    cleanHero();
    closeCurrentMenu = () => {};
    window.removeEventListener("scroll", scroll);
    toggle.removeEventListener("click", toggleMenu);
    scrim.removeEventListener("click", dismiss);
    menu.removeEventListener("click", choose);
    document.removeEventListener("keydown", key);
    document.removeEventListener("click", outside);
    chrome.removeEventListener("focusout", focusOut);
    mobile.removeEventListener("change", breakpoint);
  };
}
function carousel(root, reduced) {
  if (!root) return () => {};
  const slides = [...root.querySelectorAll("[data-hero-slide]")],
    dots = [...root.querySelectorAll("[data-hero-index]")],
    pause = root.querySelector("[data-hero-pause]");
  if (slides.length < 2) return () => {};
  let index = 0,
    timer,
    hovered = false,
    focused = false,
    paused = root.dataset.autoplay !== "true",
    disposed = false,
    animations = [],
    touchX = null,
    swiped = false;
  const stop = () => {
    animations.forEach((a) => a.stop());
    animations = [];
  };
  function schedule() {
    clearTimeout(timer);
    if (
      !paused &&
      !reduced.matches &&
      !document.hidden &&
      !hovered &&
      !focused &&
      !disposed
    )
      timer = setTimeout(
        () => show(index + 1),
        Number(root.dataset.interval) * 1000,
      );
  }
  function show(next) {
    const target = (next + slides.length) % slides.length;
    if (target === index) return;
    stop();
    slides.forEach((slide, i) => {
      slide.hidden = i !== index && i !== target;
      slide.inert = i !== target;
      slide.setAttribute("aria-hidden", String(i !== target));
      slide.style.opacity = i === target ? "0" : "1";
      slide.style.zIndex = i === target ? "1" : "0";
    });
    index = target;
    slides[index].hidden = false;
    const a = animate(
      slides[index],
      { opacity: [0, 1] },
      { duration: reduced.matches ? 0 : 0.55 },
    );
    animations.push(a);
    Promise.resolve(a).then(() => {
      if (!disposed && index === target)
        slides.forEach((slide, i) => {
          slide.hidden = i !== index;
        });
    });
    dots.forEach((dot, i) =>
      dot.setAttribute("aria-pressed", String(i === index)),
    );
    schedule();
  }
  function click(event) {
    if (swiped && event.target.closest("[data-hero-slide]")) {
      event.preventDefault();
      swiped = false;
      return;
    }
    const dot = event.target.closest("[data-hero-index]"),
      direction = event.target.closest("[data-hero-direction]");
    if (dot) show(Number(dot.dataset.heroIndex));
    if (direction) show(index + Number(direction.dataset.heroDirection));
    if (event.target.closest("[data-hero-pause]")) {
      paused = !paused;
      pause.setAttribute(
        "aria-label",
        paused ? "Play banner rotation" : "Pause banner rotation",
      );
      pause.setAttribute("aria-pressed", String(paused));
      schedule();
    }
  }
  const enter = () => {
      hovered = true;
      schedule();
    },
    leave = () => {
      hovered = false;
      schedule();
    },
    focus = () => {
      focused = true;
      schedule();
    },
    blur = (event) => {
      if (!root.contains(event.relatedTarget)) {
        focused = false;
        schedule();
      }
    };
  const key = (event) => {
    if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      show(index + (event.key === "ArrowRight" ? 1 : -1));
    }
  };
  const down = (event) => {
    if (event.pointerType === "touch") {
      touchX = event.clientX;
      swiped = false;
    }
  };
  const up = (event) => {
    if (touchX !== null && Math.abs(event.clientX - touchX) > 45) {
      swiped = true;
      show(index + (event.clientX < touchX ? 1 : -1));
    }
    touchX = null;
  };
  const cancel = () => {
    touchX = null;
  };
  const visibility = () => schedule();
  root.addEventListener("click", click);
  root.addEventListener("mouseenter", enter);
  root.addEventListener("mouseleave", leave);
  root.addEventListener("focusin", focus);
  root.addEventListener("focusout", blur);
  root.addEventListener("keydown", key);
  root.addEventListener("pointerdown", down);
  root.addEventListener("pointerup", up);
  root.addEventListener("pointercancel", cancel);
  document.addEventListener("visibilitychange", visibility);
  reduced.addEventListener("change", visibility);
  schedule();
  return () => {
    disposed = true;
    clearTimeout(timer);
    stop();
    root.removeEventListener("click", click);
    root.removeEventListener("mouseenter", enter);
    root.removeEventListener("mouseleave", leave);
    root.removeEventListener("focusin", focus);
    root.removeEventListener("focusout", blur);
    root.removeEventListener("keydown", key);
    root.removeEventListener("pointerdown", down);
    root.removeEventListener("pointerup", up);
    root.removeEventListener("pointercancel", cancel);
    document.removeEventListener("visibilitychange", visibility);
    reduced.removeEventListener("change", visibility);
  };
}
