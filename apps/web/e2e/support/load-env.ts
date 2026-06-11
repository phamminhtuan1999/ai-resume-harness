import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Minimal .env loader for the Playwright (Node) context — Next loads these for
// the app, but the test runner needs them too. Reads apps/web/.env then
// .env.local (local wins). Existing process.env values are never overwritten.
export function loadWebEnv(): void {
  const dir = resolve(__dirname, "..", "..");
  for (const file of [".env", ".env.local"]) {
    const path = resolve(dir, file);
    if (!existsSync(path)) continue;
    for (const rawLine of readFileSync(path, "utf8").split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}
