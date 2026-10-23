import { cp, mkdir, rm, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await mkdir("public/vendor", { recursive: true });
await cp("node_modules/motion/dist/motion.js", "public/vendor/motion.js");
await cp("node_modules/motion/LICENSE.md", "public/vendor/MOTION-LICENSE.txt");
for (const [source, destination] of [
  ["dist/lenis.mjs", "lenis.mjs"],
  ["dist/lenis.css", "lenis.css"],
  ["LICENSE", "LENIS-LICENSE.txt"],
])
  await cp(`node_modules/lenis/${source}`, `public/vendor/${destination}`);
for (const file of [
  "public/app.js",
  "public/scroll-motion.js",
  "public/banner-admin.js",
  "public/storefront-interactions.js",
  "public/data.js",
  "public/api.js",
  "public/live-controller.js",
  "public/policies.js",
]) {
  const check = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });
  if (check.status !== 0) process.exit(check.status || 1);
}
for (const file of [
  "public/index.html",
  "public/styles.css",
  "public/storefront.css",
  "public/assets/terracotta-pots.jpg",
  "public/assets/garden-hero.png",
])
  await access(file);
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
console.log("Kaushik Nursery built successfully → dist/");
