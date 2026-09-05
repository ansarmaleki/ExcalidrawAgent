// evals/scoreRun.ts — score result files and print them side by side.
// Usage: tsx evals/scoreRun.ts results/A.json [results/B.json ...]
// Scoring is separate from running: results are saved raw, so old runs can
// be re-scored when a scorer improves. Comparing two runs is the Day 2
// workflow — "did the number move?".
import fs from "node:fs";
import path from "node:path";
import { SCORERS, type Scorer, type ScoredOutput } from "./scorers.js";
import type { Case } from "./buildMessages.js";
import type { Element } from "../canvas.js";

type Row = ScoredOutput & { id: string; ms: number; error: string | null };

if (process.argv.length < 3) {
  console.error("Usage: tsx evals/scoreRun.ts <results.json> [<results.json> ...]");
  process.exit(1);
}

const CASES: Record<string, Case> = Object.fromEntries(
  JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "golden.json"), "utf8"))
    .map((c: Case) => [c.id, c]));

function scoreFile(file: string) {
  const rows: Row[] = JSON.parse(fs.readFileSync(file, "utf8"));
  const averages: Record<string, number[]> = {};
  let errored = 0, totalMs = 0;
  for (const r of rows) {
    if (r.error) errored++;
    totalMs += r.ms ?? 0;
    const c = CASES[r.id];
    if (!c) {
      console.warn(`warning: result id ${r.id} not in golden.json — skipped`);
      continue;
    }
    for (const [name, fn] of Object.entries(SCORERS) as [string, Scorer][]) {
      const s = fn(c, { text: r.text ?? "", elements: (r.elements ?? []) as Element[] });
      if (s !== null) (averages[name] ??= []).push(s);
    }
  }
  return {
    file,
    scores: Object.fromEntries(
      Object.entries(averages).map(([name, v]) => [name, v.reduce((a, b) => a + b) / v.length])),
    counts: Object.fromEntries(
      Object.entries(averages).map(([name, v]) => [name, v.length])),
    cases: rows.length,
    errored,
    avgMs: rows.length ? Math.round(totalMs / rows.length) : 0,
  };
}

const runs = process.argv.slice(2).map(scoreFile);
const names = Object.keys(SCORERS);
const label = (s: string) => s.padEnd(13);
console.log(label("scorer") + runs.map((r) => path.basename(r.file).slice(-17).padEnd(20)).join(""));
for (const name of names) {
  const row = runs.map((r) => {
    const count = r.counts[name] ?? 0;
    const cell = count ? `${(r.scores[name] * 100).toFixed(1)}%` : "n/a";
    return cell.padEnd(20);
  }).join("");
  console.log(label(name) + row);
}
console.log("");
for (const r of runs) {
  console.log(`${path.basename(r.file)}: ${r.cases} cases · ${r.errored} errored · avg ${r.avgMs}ms`);
}
