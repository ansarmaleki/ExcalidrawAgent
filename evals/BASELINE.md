# Baselines — eval history, newest first

## After Part 7 (advanced tool use) — 2026-09-06

- **Run:** `evals/results/2026-09-06T07-14-11-256Z.json` (five focused tools + query-on-demand + keyless DuckDuckGo web search; canvas state no longer embedded in instructions)
- **Pre-Part-7 run:** `evals/results/2026-09-06T07-06-58-747Z.json`

| Scorer      | Pre-Part-7 | Post-Part-7 | Δ |
|-------------|------------|-------------|---|
| Schema      | 100.0%     | 100.0%      | — |
| Structure   | 90.3%      | 90.3%       | — |
| Preservation| 100.0%     | 100.0%      | — |
| Keywords    | n/a        | n/a         | — |
| avg ms      | 5354       | 8067 (+51%) | see below |

**Verdict — shipped. Scores flat (saturated), one honest duration caveat:**

- Preservation was already 100% pre-swap, so the additive `add_elements` couldn't lift the number — but it makes preservation STRUCTURAL (add physically cannot clobber; remove is the only deletion path) instead of dependent on the model choosing to reuse ids. The 3 add-cases verify the new path works (modify-10: cache added between api/db, both seed ids intact).
- Duration: the +51% average is one 49s create-04 outlier; excluding it the run averages ~5.1s (−4%). Structural cost observed: modify turns pay one extra round trip for `query_canvas` first (~+1.3s on modify-01) — the handout's −41% assumed a naive baseline that regenerated whole diagrams per change; ours already made single calls, so there was nothing to reclaim.
- `update_elements` reports unknown ids so the model self-corrects; batch updates cut call count on multi-element changes.
- search_web (DuckDuckGo Instant Answers, keyless — no OpenAI key on this stack): verified live; errors return as `{"error":...}`, results condensed to ≤2000 chars. Thin on niche technical queries, as expected for an instant-answer API.

## Pre-Part-7 baseline (15 cases) — 2026-09-06

- **Run:** `evals/results/2026-09-06T07-06-58-747Z.json` (Goldilocks prompt + canvas state, naive two-tool surface)
- **Dataset:** 15 cases — 3 create, 12 modify (9 recolor/rename/move/resize + 3 new "add" cases modify-10/11/12).
- **Endpoint / model:** https://api.deepseek.com / deepseek-v4-flash

| Scorer      | Baseline | Notes |
|-------------|----------|-------|
| Schema      | 100.0%   | All runs valid. |
| Structure   | 90.3%    | Remaining gap: shape drift on create cases (ellipses vs rectangles, stray text elements). |
| Preservation| 100.0%   | Prediction FAILED honestly: even the 3 add-cases preserved seed ids under naive tools — the model regenerates the full diagram but reuses the exact ids it saw in canvas state + seeded history. The handout's "naive tools crater preservation on add" does not reproduce on this model. |
| Keywords    | n/a      | No domain cases yet. |

Duration: 15 cases, 0 errored, avg 5354ms.

**What Part 7 can therefore prove here:** Preservation is saturated; the measurable targets are Structure (focused tools reduce regeneration-style sloppiness) and duration (canvas state leaves the every-turn prompt; query-on-demand instead). The mechanism win — preservation made STRUCTURAL (add_elements physically cannot clobber) rather than prompt-dependent — remains valuable regardless of scores.

## After Part 6 (context engineering) — 2026-09-05

- **Run:** `evals/results/2026-09-05T14-18-25-302Z.json` (Goldilocks prompt + canvas state in instructions, compaction in REPL)
- **Change:** `agent.ts`/`streaming.ts` build `instructions = BASE_PROMPT + canvas state` at call time; `context.ts`, `compaction.ts` added; REPL buffers input lines.

| Scorer      | Pre-Part-6 | Post-Part-6 | Δ |
|-------------|------------|-------------|---|
| Schema      | 100.0%     | 100.0%      | — |
| Structure   | 80.6%      | 80.6%       | — |
| Preservation| 100.0%     | 100.0%      | — |
| Keywords    | n/a        | n/a         | — |
| avg ms      | 5340       | 5095        | −4.6% (noise) |

**Verdict — shipped despite flat numbers, because the mechanism is load-bearing:**

- Eval preservation was already saturated (seeded history contains the ids; deepseek-v4-flash recovers them), so no headroom existed for canvas state to lift. The handout's ~2× preservation jump assumes a model that CANNOT see ids; ours could.
- REPL proof (live 2-turn session): with canvas state in the prompt the agent recognized "the canvas already has exactly what you're asking for" on turn 1 and recolored `rect_login` → `#fa5252` via `modify_diagram` on turn 2, leaving `rect_database` untouched — without canvas state, post-compaction sessions lose the tool-call history and have NO source of ids. The mechanism protects long sessions, which the 2-turn eval seeds cannot measure.
- create-05 dropped 2 stray text elements (9 → 7 elements, counts unaffected → Structure unchanged). Shape drift (ellipses vs rectangles) persists — Part 7's focused tools and Part 11's planning are the next levers for Structure.
- Bonus fix: REPL input buffering (readline dropped piped lines arriving mid-turn; multi-turn piped sessions hung). Eval harness unaffected.

## Pre-Part-6 baseline (12 cases) — 2026-09-05

- **Run:** `evals/results/2026-09-05T14-11-57-855Z.json` (naive prompt, naive tools)
- **Endpoint / model:** https://api.deepseek.com / deepseek-v4-flash
- **Dataset:** 12 cases — 3 create, 9 modify (8 new hand-written + modify-01), every modify case with preservedIds.

| Scorer      | Baseline | Notes |
|-------------|----------|-------|
| Schema      | 100.0%   | All runs valid. |
| Structure   | 80.6%    | create cases: shapes drift from the requested counts (ellipses vs rectangles). |
| Preservation| 100.0%   | Honest finding, NOT luck this time: the seeded history contains the generate_diagram tool call with element ids, and deepseek-v4-flash recovers them — every modify applied correctly (renames, recolors, move, resize all verified). The handout's ~25% naive-preservation shape does not reproduce on this stack/model. |
| Keywords    | n/a      | No domain cases yet. |

Duration: 12 cases, 0 errored, avg 5340ms.

**What Part 6 must therefore prove here:** Preservation is already saturated — the lift to watch is Structure (create layout guidance) and REPL robustness: in the live REPL, compaction strips tool-call history, so canvas state in the system prompt becomes the only source of ids. Eval numbers may move little; the mechanism still matters for long sessions.

## Day 1 Baseline — 2 handout cases — 2026-09-05

- **Run:** `evals/results/2026-09-05T13-13-28-935Z.json`
- **Dataset:** 2 cases (create-03 + modify-01) — a shape, not a statistic.

| Scorer      | Baseline | Notes |
|-------------|----------|-------|
| Schema      | 100.0%   | Valid elements. |
| Structure   | 66.7%    | Ellipses drawn where rectangles were asked. |
| Preservation| 100.0%   | Single lucky run (see 12-case entry above — turned out not to be luck). |
| Keywords    | n/a      | No domain cases. |

## Day 2 protocol

Every Day 2 part must:

1. `npm run eval` (fresh results file),
2. `npm run score -- evals/results/<new>.json <pre-part6 run>.json` (side-by-side),
3. read the delta — if the targeted number didn't move, the change doesn't ship (document WHY it didn't if the mechanism is still right, as in this file).

Keep this file updated only when a baseline is deliberately recorded.
