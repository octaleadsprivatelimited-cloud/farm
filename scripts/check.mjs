import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
async function files(dir) {
  const items = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      items.map((i) =>
        i.isDirectory()
          ? files(`${dir}/${i.name}`)
          : /\.(m?js)$/.test(i.name)
            ? [`${dir}/${i.name}`]
            : [],
      ),
    )
  ).flat();
}
for (const dir of ["server", "scripts", "public", "tests", "load-tests"])
  for (const file of await files(dir)) {
    const check = spawnSync(process.execPath, ["--check", file], {
      stdio: "inherit",
    });
    if (check.status) process.exit(check.status);
  }
console.log("JavaScript syntax checks passed");
