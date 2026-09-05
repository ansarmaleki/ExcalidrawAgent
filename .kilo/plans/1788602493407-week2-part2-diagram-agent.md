# Week 2 · Day 1 · Part 2 — The Diagram Agent (OpenAI SDK · TypeScript)

Build the Part 2 diagram-design agent from the Week 2 handout: canvas data model, two deliberately-naive tools, the recycled agent loop, the SVG renderer, and a minimal REPL that re-renders `canvas.svg` after every turn.

## Context & decisions

- **Stack**: OpenAI SDK · TypeScript (`openai` 6.x, ESM, run via `tsx`) — user-selected.
- **Location**: `D:\Projects\AI\Excalidraw\src\ExcalidrawAgent` (fresh empty git repo; this folder *is* the handout's `designer/` folder — do not create another).
- **Scope**: Part 2 ONLY. Part 3 (streaming) and Parts 4+ (evals, scorers) are out of scope — later steps.
- **Model**: `gpt-4o-mini`, `MAX_STEPS = 10`.
- **Factory pattern is load-bearing**: `makeToolFns(canvas)` binds tools to a canvas (not *the* canvas) so Part 4's harness can inject private canvases. Do not simplify this away.
- **Deliberate naivety**: `generate_diagram` replaces everything; `modify_diagram` needs exact ids. These weaknesses are the syllabus — do not "fix" them in this step.

## Prerequisite (user action)

- `OPENAI_API_KEY` is **not set** in this environment (verified: empty). Set it before running, e.g. per-session `$env:OPENAI_API_KEY = "sk-..."` or persistently via user environment variables. Never hardcode or commit the key.

## Tasks

1. **One-time setup** (handout "Set up once"): `npm init -y`, `npm pkg set type=module`, `npm i openai tsx`. Create `evals/` and `corpus/` folders (each with a `.gitkeep` so git tracks them — Parts 4 and 8 will use them). Add `.gitignore` containing `node_modules/`. Verify Node ≥ 18 with `node --version`.
2. **`canvas.ts`** — per handout: `Element` type (`id`, `type` of rectangle|ellipse|diamond|text|arrow|line, `x`, `y`, optional `width`/`height`/`text`/`strokeColor`/`backgroundColor`/`fontSize`); `applyGenerate(canvas, elements)` replaces all contents; `applyModify(canvas, elementId, updates)` updates one element by id, skipping null values, returns friendly error string when id is absent.
3. **`tools.ts`** — per handout: `ELEMENT_SCHEMA` (required: `id`, `type`, `x`, `y`, `width`, `height`), `TOOLS` array with `generate_diagram` and `modify_diagram` as OpenAI function schemas, and `makeToolFns(canvas)` dispatch factory returning `Record<string, (a: any) => string>`.
4. **`agent.ts`** — per handout: `client`, `MODEL`, `MAX_STEPS`, `SYSTEM_PROMPT`, and `runTurn(messages, toolFns, tools = TOOLS)`: call model → if no `tool_calls`, return text → else parse each call's JSON args, dispatch via `toolFns[name]`, push tool result messages, loop; after 10 steps return `"Stopped: hit the step limit."` Export `client`, `MODEL`, `SYSTEM_PROMPT` for later parts.
5. **`svg.ts`** — `svgString(canvas)` + `renderSvg(canvas, path = "canvas.svg")`. **Warning**: the handout's TS `svg.ts` has PDF-truncated lines — the `style` template literal and the `<line>` push are cut mid-string. Reconstruct from the complete Python `svg.py`: `style = fill="..." stroke="..." stroke-width="2"`; lines/arrows use `<line x1 y1 x2 y2 stroke stroke-width="2">` with arrows getting ` marker-end="url(#head)"`; any element with `text` also renders a centered `<text>`; include the `<defs><marker id="head">` arrowhead in the SVG wrapper; escape text with the `esc` helper.
6. **`main.ts`** — minimal REPL (implied by handout "the REPL re-renders the SVG after every turn"): seed `messages` with `{ role: "system", content: SYSTEM_PROMPT }`; `readline/promises` loop; exit on `exit`/`quit`; skip empty input; push user message; `await runTurn(messages, makeToolFns(canvas))`; print the returned text; `renderSvg(canvas)` after every turn.
7. **Typecheck (recommended)**: add `tsconfig.json` (strict, `module: "NodeNext"`, `target: "ES2022"`, `noEmit: true`, include `*.ts`) and validate with `npx tsc --noEmit`. Note: source imports use `.js` extensions (`./canvas.js`) per handout ESM style — correct under NodeNext.

## Validation

- With key set: run `npx tsx main.ts`
  - "draw a flowchart with Start, Process, and End boxes connected by arrows" → `canvas.svg` contains 3 labeled rectangles + 2 arrows; open `canvas.svg` in a browser to eyeball.
  - "make the Start box red" → `applyModify` path fires; that rect's `backgroundColor` changes; other elements untouched.
  - Confirm a second turn sees prior conversation (multi-turn memory via messages).
- `npx tsc --noEmit` passes clean.

## Risks / notes

- `npm install` / `node` commands are not in the pre-approved permission allowlist — expect confirmation prompts or run them in the user's own terminal.
- If `OPENAI_API_KEY` is missing at runtime the OpenAI client throws a clear auth error — fix by setting the key, not by code changes.
- Known-by-design weaknesses (measured in Part 4-5, fixed in Part 6-7): no canvas state in the model's context, `modify_diagram` requires ids the user never knows, regeneration clobbers the canvas. Leave them.

## Out of scope

Part 3 streaming (`streaming.ts`), Part 4 golden dataset + harness, Part 5 scorers, anything from Day 2.
