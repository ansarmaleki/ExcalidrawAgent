// env.ts — load .env once, before any module reads process.env. The path is
// resolved relative to THIS file (not cwd), so the build works from any
// directory; both the source layout (env.ts at root) and the compiled layout
// (dist/env.js, .env one level up) are covered. Imported FIRST in agent.ts
// and main.ts: ESM evaluates imports in order, so modules below see the vars.
import fs from "node:fs";
import path from "node:path";

const candidates = [
  path.join(import.meta.dirname, ".env"),       // source layout
  path.join(import.meta.dirname, "..", ".env"), // compiled dist/ layout
];
const envPath = candidates.find((p) => fs.existsSync(p));
try {
  if (envPath) process.loadEnvFile(envPath);
} catch (e) {
  console.warn(`Warning: could not load ${envPath} (${e})\n`);
}
