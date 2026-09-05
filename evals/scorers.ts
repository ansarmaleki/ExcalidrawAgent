// evals/scorers.ts — four deterministic graders. Each returns 0..1, or null
// meaning "this scorer doesn't apply to this case". The null trick lets one
// set of scorers cover the whole dataset. Pure logic over the saved JSON —
// no model, no framework.
import type { Case } from "./buildMessages.js";
import type { Element } from "../canvas.js";

export type ScoredOutput = { text: string; elements: Element[] };
export type Scorer = (c: Case, out: ScoredOutput) => number | null;

const REQUIRED = ["id", "type", "x", "y", "width", "height"];
const TYPES = new Set(["rectangle", "ellipse", "diamond", "text", "arrow", "line"]);

const schemaScore: Scorer = (_c, out) => {
  // Is every element valid? Catches the worst failures: nothing, garbage.
  const els = out.elements;
  if (!els.length) return 0;
  for (const el of els)
    if (REQUIRED.some((f) => !(f in el)) || !TYPES.has(el.type)) return 0;
  return 1;
};

const structureScore: Scorer = (c, out) => {
  // Parse "3 rectangle elements" from the expected characteristics and
  // compare against actual counts by type. Proportional credit.
  const counts: Record<string, number> = {};
  for (const el of out.elements) counts[el.type] = (counts[el.type] ?? 0) + 1;
  const scores: number[] = [];
  for (const want of c.expectedCharacteristics) {
    const m = want.match(/^(\d+) (\w+) elements?/);
    if (!m) continue;
    const [n, t] = [Number(m[1]), m[2]];
    scores.push(Math.max(0, 1 - Math.abs((counts[t] ?? 0) - n) / n));
  }
  return scores.length ? scores.reduce((a, b) => a + b) / scores.length : null;
};

const preservationScore: Scorer = (c, out) => {
  // Modify cases: did the seed elements SURVIVE, or did the agent nuke the
  // canvas and start over? The measure of respectful editing.
  const ids = c.preservedIds;
  if (!ids?.length) return null;
  const have = new Set(out.elements.map((el) => el.id));
  return ids.filter((i) => have.has(i)).length / ids.length;
};

const keywordScore: Scorer = (c, out) => {
  // Domain cases: does the right vocabulary show up? Deliberately dumb —
  // RAG (Part 8) is what lifts it.
  const kws = c.expectedKeywords;
  if (!kws?.length) return null;
  const labels = out.elements.map((el) => el.text ?? "").join(" ");
  const hay = `${out.text} ${labels}`.toLowerCase();
  return kws.filter((k) => hay.includes(k.toLowerCase())).length / kws.length;
};

export const SCORERS: Record<string, Scorer> = {
  Schema: schemaScore,
  Structure: structureScore,
  Preservation: preservationScore,
  Keywords: keywordScore,
};
