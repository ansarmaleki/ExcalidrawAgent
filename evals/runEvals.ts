// evals/runEvals.ts — the driver: loop cases, time each, save to a timestamped
// results file. run_case runs the SAME loop production uses, against a PRIVATE
// canvas seeded from the test data (runTurn takes the canvas directly and
// binds canvas-bound tools inside; the system prompt rides as `instructions`,
// so it is not in messages). Importing ../agent.js loads ./env.js transitively,
// picking up .env before the first request.
import fs from "node:fs";
import path from "node:path";
import type { ModelMessage } from "ai";
import { runTurn } from "../agent.js";
import { buildMessages, type Case } from "./buildMessages.js";
import type { Element } from "../canvas.js";

const CASES: Case[] = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "golden.json"), "utf8"));

// One case: a PRIVATE canvas seeded from the test data, run through the SAME
// loop production uses, with tools bound to that private canvas.
async function runCase(c: Case) {
  const canvas = (c.seed?.elements ?? []).map((el) => ({ ...(el as Element) }));
  const messages: ModelMessage[] = buildMessages(c);
  const text = await runTurn(messages, canvas);
  return { text, elements: canvas }; // canvas AFTER the agent acted
}

const results: any[] = [];
for (const c of CASES) {
  const t0 = Date.now();
  let out = { text: "", elements: [] as Element[] }, err: string | null = null;
  try { out = await runCase(c); } catch (e) { err = String(e); }
  results.push({ id: c.id, input: c.input, ...out, ms: Date.now() - t0, error: err });
  console.log(`[${c.id}] ${c.difficulty.padEnd(7)} ${out.elements.length} elements, ` +
    `${results.at(-1).ms}ms` + (err ? ` ERROR: ${err}` : ""));
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const resultsDir = path.join(import.meta.dirname, "results");
fs.mkdirSync(resultsDir, { recursive: true });
const file = path.join(resultsDir, `${stamp}.json`);
fs.writeFileSync(file, JSON.stringify(results, null, 2));
console.log(`\nWrote ${file} — score it with scoreRun.ts (Part 5).`);
console.log(`Dataset note: golden.json currently holds only the 2 handout cases;`);
console.log(`hand-write ~18 more across create/modify/domain/edge (Exercise 1).`);
