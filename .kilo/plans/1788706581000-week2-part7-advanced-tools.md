# Week 2 · Day 2 · Part 7 — Advanced Tool Use (focused CRUD, query on demand, web search)

The tool surface is part of the prompt: better tools change behavior more than better prompting. Three moves, plus the measurement discipline.

## User-approved decisions

1. **searchWeb backend: keyless DuckDuckGo** Instant Answer API (no OpenAI key exists on this DeepSeek setup; handout's Responses-API `web_search` is not portable here). Errors return, never raise; results condensed.
2. **Extend golden.json with ~3 "add" cases** and re-baseline BEFORE the code swap — Part 7's additive-tools win ("add a cache between api and db" without clobbering) is currently untestable: every existing modify case passes with the naive tools.

## Protocol (measure-first, same as Part 6)

1. Extend dataset → 2. pre-Part-7 baseline run with CURRENT code → 3. implement v2 tools → 4. post-Part-7 run → 5. side-by-side score + BASELINE.md entry.

## Tasks (ordered)

1. **`evals/golden.json`** — add 3 add-cases (category "modify", difficulty simple/medium), each: seed of 2–3 labeled boxes with meaningful ids, an "add" request in user vocabulary, `preservedIds` covering EVERY seeded element, and count-style expectedCharacteristics (e.g. "3 rectangle elements") so Structure scores the addition:
   - `modify-10`: seed rect_api + rect_db; "add a cache box between the api and the db".
   - `modify-11`: seed rect_client + rect_server; "add a load balancer box in front of the server".
   - `modify-12`: seed rect_ceo + 2 manager rects; "add a new manager box next to the other managers".
2. **Pre-Part-7 baseline** — `npm run eval` + `npm run score` on the 15-case dataset with unchanged code; record in `evals/BASELINE.md` (newest-first entry). Prediction to verify: add-cases crater Preservation (naive tools force `generate_diagram` → ids replaced) while the 12 existing cases hold.
3. **`tools.ts`** — export `elementSchema` (currently module-local) so v2 can reuse the single shape definition. Naive pair stays as the course before/after artifact (canvas.ts `applyGenerate`/`applyModify` likewise stay).
4. **`tools_v2.ts`** (new) — `makeToolsV2(canvas)` returning five Vercel tools, handout-faithful with one deliberate fix:
   - `add_elements` — purely additive (`canvas.push`), description carries the example call. It physically cannot clobber.
   - `update_elements` — batch `[{id, fields}]`, `fields: elementSchema.omit({ id: true }).partial()` — **the handout's version has the id-mutation bug we already fixed in the Part 2 review; omit `id` from fields here too**. Execute reports applied count plus any unknown ids ("Applied 2 updates. Unknown ids: rect_x") so the model can self-correct.
   - `remove_elements` — explicit ids array, filters the canvas; the only path to losing an element.
   - `query_canvas` — no args; `execute: () => serializeCanvas(canvas)` (reuse `context.ts`). Description: "Call BEFORE modifying or removing. Never invent ids."
   - Example calls live inside every description — few-shot that travels with the tool.
5. **`search.ts`** (new) — `searchWeb` Vercel tool wrapping DuckDuckGo Instant Answers:
   - `inputSchema: z.object({ query: z.string() })`.
   - `execute`: `fetch("https://api.duckduckgo.com/?q=…&format=json&no_html=1&skip_disambig=1", { signal: AbortSignal.timeout(10_000) })`; condense AbstractText + up to 5 RelatedTopics texts, each truncated, total sliced to 2000 chars; return as a JSON string. **Every failure path (network, non-200, bad JSON) returns `JSON.stringify({ error: … })` — never throws** (a thrown exception kills the loop).
6. **`agent.ts`** — swap `makeTools` → `{ ...makeToolsV2(canvas), search_web: searchWeb }`; instructions become the **updated BASE_PROMPT WITHOUT canvas state** (query_canvas replaces Part 6's every-turn serialization — turns that don't need state don't pay for it). Prompt rewrite, same Goldilocks structure:
   - Capabilities: the five tools, one line each.
   - Behavioral guidelines: call `query_canvas` before modifying/removing, never invent ids; `add_elements` is purely additive — extend, never regenerate to add; preserve what exists.
   - Examples: "make the login box red" → `update_elements`; "add a cache between the api and the db" → `add_elements` with ONE new rect, existing ids stay.
   - `buildSystem` no longer used here; `context.ts` stays (feeds query_canvas).
7. **`streaming.ts`** — identical tool swap + same updated instructions (REPL and evals must not diverge).
8. **`evals/buildMessages.ts`** — fabricated history must match the CURRENT tool surface: toolName `"add_elements"`, result text `"Added N elements."` (seeds the agent can't distinguish from lived sessions; also removes the no-such-tool risk of a `generate_diagram` call appearing in history for a tool that no longer exists).
9. **Post-Part-7 run** — `npm run eval`, `npm run score -- <post>.json <pre-part7>.json`, BASELINE.md entry with the delta table and honest verdict.

## Validation

- `npm run check` + `npm test` clean.
- Pre-baseline recorded BEFORE any tool swap lands.
- Post-run expectations: Preservation back to 100% on all 15 (add-cases fixed by additive adds); create cases unaffected (empty canvas + add_elements); duration watched (leaner prompts, but modify turns gain a query_canvas call — handout claims −41%, ours may differ).
- REPL piped smoke (the handout's headline scenario, live): "draw two rectangles labeled api and db" → "add a cache box between the api and the db" → exit; verify `canvas.json` keeps rect_api/rect_db ids AND adds the new box.
- searchWeb offline check (temp script, deleted after): execute with a real query — returns JSON string with content or `{error}`, never throws; abort/timeout path exercised by a bogus URL.

## Risks / notes

- Model may skip query_canvas and invent ids in the REPL → watch add-case preservation and the "Unknown ids" reports.
- DDG quality is modest for tech queries; acceptable — Part 8 RAG supersedes the network tool, and the pattern (errors return, condense) is the lesson.
- DeepSeek juggling 5 tools may mis-pick occasionally; a Structure dip would surface it in the side-by-side.
- Seeds referencing `add_elements` only make sense after task 8; task ordering (dataset → baseline → code) keeps every run internally consistent.

## Out of scope

Part 8 RAG (embeddings provider decision — same external-API question, next part), Part 10 approvals/undo (remove_elements stays ungated for now), pass^k runs, prompt-experiment sweeps beyond the one rewrite.
