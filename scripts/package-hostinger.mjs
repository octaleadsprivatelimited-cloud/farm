import { cp, rm, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
// The Hostinger deployment tool packs this directory itself and ignores .gitignore.
const root = process.cwd(),
  stage = path.join(root, "output", "deploy", "source");
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
for (const file of [
  "package.json",
  "package-lock.json",
  "server",
  "database",
  "public",
  "scripts",
  "deploy",
  "docs",
  "tests",
  "load-tests",
  "README.md",
  "ASSETS.md",
  ".env.example",
  "Dockerfile",
  ".dockerignore",
  "compose.yaml",
])
  await cp(path.join(root, file), path.join(stage, file), {
    recursive: true,
    filter: (p) =>
      !/(^|\/)(node_modules|\.git|var|tmp|results|production\.env)(\/|$)/.test(
        path.relative(root, p),
      ),
  });
let bytes = 0;
async function scan(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) await scan(p);
    else {
      if (item.name.startsWith(".env") && item.name !== ".env.example")
        throw Error("Unexpected environment file");
      if (/\.(pem|key|p12|tar|gz)$/.test(item.name))
        throw Error("Unexpected secret or archive");
      bytes += (await stat(p)).size;
    }
  }
}
await scan(stage);
if (bytes > 45 * 1024 * 1024)
  throw Error("Source exceeds conservative native deployment limit");
console.log(
  JSON.stringify({ sourceDirectory: stage, bytes, secretsExcluded: true }),
);
