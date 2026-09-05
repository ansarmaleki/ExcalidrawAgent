# Week 2 · Day 1 · Part 4 — The Eval Discipline (golden dataset + harness)

Build the Part 4 eval foundation on the Vercel AI SDK track: `evals/golden.json` (the handout's 2 example cases only — the user hand-writes the other ~18 as Exercise 1), `evals/buildMessages.ts` (fabricated conversation for modify seeds), and `evals/runEvals.ts` (driver that runs every case through the IDENTICAL production loop against a private canvas and saves timestamped raw results). Scorers and the baseline read-out are Part 5 — out of scope.

## Context & decisions

- **Reuse `runTurn` from `agent.ts`** (non-streaming `generateText`): the whole point of the Part 2 factory design. `streamTurn` is presentation-only and stays out of evals. Our `runTurn` already pushes `result.responseMessages` (the ai@7 all-steps accumulator — the handout erratum we fixed in the Part 2 review).
- **Vercel track specifics**: `runTurn(messages, canvas)` takes the canvas directly (tools bind inside), and the system prompt rides as `instructions` — so `buildMessages` must NOT emit a system message (unlike the OpenAI/LangChain tracks). Importing `../agent.js` also loads `./env.js` transitively, so `.env` (DeepSeek endpoint) is picked up automatically — no extra wiring.
- **Dataset scope (user decision)**: only the handout's two cases verbatim — `create-03` (no seed) and `modify-01` (seed with 2 elements, `preservedIds`). The driver prints a note reminding that the dataset is a 2-case stub.
- **Results tracked in git**: the handout defines `evals/` as "test cases and results"; run files are small and Part 5 compares them side by side. `evals/results/` stays committed (no gitignore entry).
- **Paths relative to the module** (`import.meta.dirname`), matching `env.ts`/`server.ts` — the driver runs from repo root or anywhere.

## Tasks

1. **`evals/golden.json`** — the two handout cases verbatim:
   - `create-03`: input "Draw a flowchart with Start, Process, and End boxes connected by arrows", 3 expectedCharacteristics, difficulty "simple", category "create".
   - `modify-01`: input "make the login box red", seed {userPrompt, assistantConfirmation, elements: rect_login + rect_db}, 2 expectedCharacteristics, `preservedIds: ["rect_login", "rect_db"]`, difficulty "simple", category "modify".

2. **`evals/buildMessages.ts`** — `buildMessages(c: Case): ModelMessage[]`:
   - No seed → `[{ role: "user", content: c.input }]`.
   - With seed → user prompt, assistant message whose content is a **tool-call part** (`type: "tool-call"`, `toolCallId: seed_<caseId>`, `toolName: "generate_diagram"`, `input: { elements: seed.elements }`), tool-role message with a **tool-result part** (matching `toolCallId`/`toolName`, `output: { type: "text", value: "Canvas replaced: N elements." }`), assistant confirmation text, then the actual test user message.
   - Verify exact part shapes against `node_modules/ai/dist/index.d.ts` (`ModelMessage` / `ToolModelMessage` / tool-call / tool-result part types) during implementation — the handout snippet is the guide but the installed d.ts is the truth. Export a `Case` type for the JSON shape (id, input, expectedCharacteristics, difficulty, category, optional seed, optional preservedIds, optional expectedKeywords).

3. **`evals/runEvals.ts`** — driver:
   - `runCase(c)`: `canvas = (c.seed?.elements ?? []).map(el => ({...el}))` (private, cloned); `messages = buildMessages(c)`; `text = await runTurn(messages, canvas)`; return `{ text, elements: canvas }` — the canvas AFTER the agent acted.
   - Loop cases: `Date.now()` timing, per-case try/catch (`out = { text: "", elements: [] }`, `err = String(e)`), push `{ id, input, ...out, ms, error }`, print `[id] difficulty  N elements, Mms` (+ ERROR when set) — the handout driver shape.
   - Save to `path.join(import.meta.dirname, "results", "<stamp>.json")` where stamp = `new Date().toISOString().replace(/[:.]/g, "-")`; `mkdirSync(recursive)`. Final print: wrote file, "score it with Part 5" reminder, and note that golden.json currently holds only the 2 handout cases.

4. **Config wiring**:
   - `tsconfig.json` include: add `"evals/**/*.ts"`.
   - `tsconfig.build.json` exclude: add `"evals"` (eval tooling is not shipped in dist).
   - `package.json` scripts: add `"eval": "tsx evals/runEvals.ts"`.

## Validation

- `npm run check` — typecheck clean (evals included).
- `npm run eval` — runs the 2 cases against the live DeepSeek endpoint:
  - create-03: elements populated (roughly 5: 3 rects + 2 arrows), text non-empty, error null.
  - modify-01: canvas after the turn still contains rect_login AND rect_db (the model must not regenerate from scratch — if it calls generate_diagram, preservation fails; that's the expected naive-tool failure the handout WANTS to see, not a harness bug).
  - `evals/results/<stamp>.json` written with 2 entries carrying text/elements/ms/error fields; durations sane; process exits 0.

## Risks / notes

- modify-01 will likely FAIL preservation with the naive tools (the handout's design: "modify — baseline terrible"). The harness must still record it cleanly — a 0-preservation result is a valid Part 4 outcome, not an error.
- DeepSeek + tool calls with a fabricated tool-result message: if the API rejects the seeded message shape, the error is captured per-case in the results file — inspect and adjust the part shape against the d.ts, not the handout.
- Sequential execution, no concurrency — avoids rate limits, keeps timing meaningful.

## Out of scope

Part 5 (scorers, scoreRun, baseline read-out), pass^k reliability runs, the other ~18 golden cases (user's Exercise 1), any web/server changes.
