# Week 2 · Day 1 · Part 5 — Automated Scorers & Baseline

Port the handout's four deterministic graders to TypeScript, add a side-by-side run comparison CLI, score the existing Part 4 result file, and record the Day 1 baseline in `evals/BASELINE.md` (user-approved). No model calls in the scorers — pure logic over the saved JSON.

## Context & decisions

- **Code graders only** (handout: "we write four small ones and skip the judge entirely"). LLM-as-judge is Exercise 2; out of scope.
- **Typed, not `any`**: scorers import `Case` from `./buildMessages.js` and `Element` from `../canvas.js`; output shape is `{ text: string; elements: Element[] }` — matches the rows `runEvals.ts` already writes.
- **Deviation from handout (intentional)**: a scorer with zero applicable cases prints `n/a` instead of the handout's misleading `0.0%`. With the current 2-case dataset Keywords has no applicable cases — `0.0%` would read as failure when it means "not measured". Per-scorer applicable-count is tracked for this.
- **Baseline file**: `evals/BASELINE.md` (user chose it) — Day 2 parts re-run the eval and diff against it.
- **Baseline source**: score the existing run `evals/results/2026-09-05T13-13-28-935Z.json` (2 cases, DeepSeek). Numbers to expect, verified by hand: Schema 100% (5 and 2 valid elements), Structure ≈66.7% (create-03: "3 rectangle elements" vs 1 rect → 1/3 credit; "2 arrow elements" vs 2 → 1.0), Preservation 100% (both seed ids survived — single-run luck), Keywords n/a.

## Tasks

1. **`evals/scorers.ts`** — four graders + `SCORERS` record (insertion order = table row order):
   - `schemaScore(c, out): number` — 0 when `out.elements` is empty or any element lacks a REQUIRED field (`id, type, x, y, width, height`) or its `type` is outside the 6-type set; else 1.
   - `structureScore(c, out): number | null` — for each characteristic matching `/^(\d+) (\w+) elements?/`, proportional credit `max(0, 1 - |actual(t) - n| / n)` from type counts; average; `null` when no count-style characteristics apply.
   - `preservationScore(c, out): number | null` — `null` unless `c.preservedIds` is non-empty; fraction of those ids present among `out.elements` ids.
   - `keywordScore(c, out): number | null` — `null` unless `c.expectedKeywords`; haystack = `out.text` + all element labels, lowercased; fraction of lowercased keywords contained.
   - Export `type Scorer = (c: Case, out: { text: string; elements: Element[] }) => number | null` and `SCORERS: Record<string, Scorer>` keyed `Schema, Structure, Preservation, Keywords`.

2. **`evals/scoreRun.ts`** — comparison CLI:
   - Usage: `npx tsx evals/scoreRun.ts <results.json> [<results.json> ...]`; no args → print usage and exit 1.
   - Load `golden.json` module-relative (pattern from `runEvals.ts`); map id → `Case`.
   - `scoreFile(path)` → per-scorer average over non-null scores **plus** per-scorer applicable count; skip result rows whose id is missing from golden.json with a one-line warning (guards against dataset edits crashing the run).
   - Print: header row `scorer` + each file's **basename** column; per scorer a row of percentages (1 decimal) or `n/a` when count = 0; footer per run: `N cases · M errored · avg Xms` (duration/errors are the numbers Day 2's duration comparisons need).

3. **`package.json`** — add `"score": "tsx evals/scoreRun.ts"` (usage: `npm run score -- evals/results/A.json`).

4. **Baseline read-out** — after validation passes:
   - Run scoreRun against `evals/results/2026-09-05T13-13-28-935Z.json`.
   - Write `evals/BASELINE.md`: date; endpoint + model (from `.env` values — never the key); case count (2); the scorer table; notes: Structure 67% = model drew ellipses where the case asked for rectangles; Preservation 100% is a single lucky run (handout expects ~25% at dataset scale — naive tools are flaky on modify); Keywords n/a until domain cases exist; Day 2 parts must re-run `npm run eval` + `npm run score` and diff against this file.

## Validation

- `npm run check` — typecheck clean.
- `npx tsx evals/scoreRun.ts evals/results/2026-09-05T13-13-28-935Z.json` — expect Schema 100.0%, Structure ≈66.7%, Preservation 100.0%, Keywords n/a; footer shows `2 cases · 0 errored`.
- Side-by-side: duplicate the result file under a second name in a temp copy (no API cost) and run scoreRun with both paths — verify two columns align and n/a renders; delete the temp copy.
- Hand-check one structure number against the formula to confirm the regex/credit math.

## Risks / notes

- 2-case baseline is a shape, not a statistic — every number moves ±50% on a single case flip; BASELINE.md says so explicitly.
- Div-by-zero impossible: regex requires n ≥ 1; preservation/keywords guards check non-empty arrays.
- `structureScore` counts types the model actually drew (ellipse Start/End) — that's the intended failure signal for Part 6/11 to lift.

## Out of scope

LLM-as-judge (Exercise 2), pass^k reliability runs (Exercise 3), more golden cases (Exercise 1), Part 6 context engineering.
