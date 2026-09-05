# Week 2 · Day 2 · Part 6 — Context Engineering (prompt + canvas state + compaction)

Day 2 begins: lift the baseline numbers by changing what's in front of the model. Three moves from the handout — structured Goldilocks prompt, canvas state in the prompt (rebuilt fresh each turn), compaction for long sessions — plus the measurement discipline to prove they worked.

## User-approved decisions

1. **Grow golden.json by ~10 modify/create cases first** — the 2-case baseline scored Preservation 100% by luck; Part 6's lift needs real signal.
2. **Handout's Part 6 Goldilocks prompt verbatim** (it targets exactly our two current tools).
3. **Full Part 6**: `context.ts` + `compaction.ts`, compaction wired into the REPL.

## Measurement protocol (the order matters)

Comparing Part 6-on-12-cases against naive-on-2-cases is invalid. Sequence:

1. Grow the dataset (task 1).
2. Re-run `npm run eval` with the CURRENT (naive) prompt → true pre-Part-6 baseline on the grown dataset; record in `evals/BASELINE.md` (supersedes the 2-case table — keep the old table below it as history).
3. Implement Part 6 (tasks 3–7).
4. Re-run `npm run eval`; `npm run score -- <new>.json <pre-part6>.json` side by side; keep the change only if the targeted numbers moved; append the post-Part-6 table to BASELINE.md.

## Tasks

1. **`evals/golden.json`** — grow to 12 cases (keep create-03, modify-01 verbatim; add):
   - ~8 modify cases, each with `seed` (userPrompt, assistantConfirmation, elements) and `preservedIds` covering every seeded element. Inputs use USER vocabulary (never the element id) so the model must map label→id from canvas state: recolor ("make the header box blue"), rename ("rename the database box to Postgres"), move ("move the login box 100 pixels to the right"), resize ("make the api box wider"), swap two colors, recolor inside a 5-element flowchart seed, recolor an ellipse, rename inside a 3-box seed. Seeds: 2–5 elements with meaningful ids (rect_header, rect_api…) and text labels.
   - ~2 create cases with count-style expectedCharacteristics the Structure scorer parses: "4 rectangle elements … 3 arrow elements" (org chart), "2 rectangle elements … 1 diamond element" (decision). 
   - No domain/edge cases (Part 7–8 territory). Difficulty: simple/medium.
2. **Pre-Part-6 re-baseline** — `npm run eval` + `npm run score` on the grown dataset with the unchanged code; update `evals/BASELINE.md`.
3. **`context.ts`** — `serializeCanvas(canvas)`: counts summary line + per-element lines (type, id, "label", at (x,y), WxH — rounded) — ~300 chars for 5 elements; `buildSystem(base, canvas)` = `${base}\n\n# Current canvas state\n\n${serializeCanvas(canvas)}`. Framework-free, exported for reuse.
4. **`agent.ts`** — replace `SYSTEM_PROMPT` with `BASE_PROMPT` (handout Part 6 prompt verbatim: Role / Capabilities / Output constraints / Behavioral guidelines / Examples teaching decisions, including the "make the login box red" modify example). `runTurn` builds `instructions: buildSystem(BASE_PROMPT, canvas)` **at call time** — fresh state every turn, stale state never accumulates. Keep exporting the prompt name change consistent with imports in `main.ts`/`streaming.ts` (they import `SYSTEM_PROMPT` → update to `BASE_PROMPT`).
5. **`streaming.ts`** — same `instructions: buildSystem(BASE_PROMPT, canvas)` (REPL and evals must not diverge).
6. **`compaction.ts`** — `compactHistory(messages): Promise<ModelMessage[]>`: size via `JSON.stringify` sum; below 32,000 chars → return copy unchanged; else summary call via `getModel()` + `generateText` (instructions: terse paragraph, preserve every decision and every element id VERBATIM, no preamble; prompt: JSON of the old messages), keep last 4 verbatim, return `[{ role: "user", content: \`[Earlier conversation summary] ${text}\` }, ...recent]` (Vercel track: leading user note, not system).
7. **`main.ts`** — before each turn: `messages = await compactHistory(messages);` (reassign — it returns a new array). Everything else (SSE, canvas persistence, rendering) unchanged.

## Validation

- `npm run check` clean; `npm test` (smoke) still passes — canvas/svg untouched.
- Pre-Part-6 baseline recorded from a real run (task 2) BEFORE any prompt change lands.
- Post-Part-6 run: expect Preservation to rise substantially on the modify-heavy dataset (handout shape: ~2×; the pre-baseline will likely sit low because the model cannot know ids without canvas state); Schema stays ~100%; Structure flat or slightly up. Duration may rise slightly (bigger prompt).
- Compaction offline check (temp script, then delete): fabricate a messages array > 32K chars → `compactHistory` returns `[summaryUserNote, ...last4]`, last 4 verbatim, total size reduced; also a small array passes through unchanged. One cheap summary call is acceptable.
- Failure mode to watch: DeepSeek rejecting the larger instructions — surface as per-case errors in the results file, not a crash.

## Risks / notes

- Element labels flow into the system prompt via serializeCanvas — model-controlled-ish strings in a prompt slot; accepted for this local course tool (same trust level as SVG rendering, already escaped downstream).
- `preservedIds` on every modify case means Preservation is the dominant graded number — by design, it is the number Part 6 claims to lift.
- Two full eval runs (12 cases each) ≈ cents on DeepSeek.
- If Preservation does NOT move: suspect the model regenerating anyway (tool problem → Part 7), not the context wiring — that's the diagnostic the handout builds.

## Out of scope

Part 7 focused tools (query_canvas will replace every-turn serialization), RAG, pass^k reliability runs, LLM-judge, web/SSE changes.
