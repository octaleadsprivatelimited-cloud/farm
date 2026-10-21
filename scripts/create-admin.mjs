import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { loadConfig } from "../server/config.js";
import { createDatabase, rows } from "../server/db.js";
import { passwordHash } from "../server/security.js";
const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string", default: "Nursery Administrator" },
  },
});
if (!values.email || !/^\S+@\S+\.\S+$/.test(values.email))
  throw Error("Provide --email for the new administrator");
let password = "";
if (!stdin.isTTY) {
  for await (const chunk of stdin) password += chunk;
  password = password.trim();
} else {
  stdout.write("Administrator password (hidden): ");
  stdin.setRawMode(true);
  for await (const chunk of stdin) {
    const s = chunk.toString();
    if (s.includes("\u0003")) process.exit(130);
    if (s.includes("\r") || s.includes("\n")) break;
    for (const ch of s) {
      if (ch === "\u007f") password = password.slice(0, -1);
      else password += ch;
    }
  }
  stdin.setRawMode(false);
  stdout.write("\n");
  stdin.pause();
}
if (password.length < 16 || password.length > 128)
  throw Error(
    "Use a unique administrator password between 16 and 128 characters",
  );
const db = await createDatabase(loadConfig());
try {
  await rows(
    db,
    "INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,'admin')",
    [values.name, values.email.toLowerCase(), await passwordHash(password)],
  );
  console.log("Administrator created. No default admin or master PIN exists.");
} finally {
  await db.end();
}
