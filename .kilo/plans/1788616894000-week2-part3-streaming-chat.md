# Week 2 · Day 1 · Part 3 — The Chat Experience (streaming, terminal + web SSE)

Stream the agent's text as the model produces it and announce tool calls as live status — in the terminal REPL **and** the Excalidraw web view (user chose SSE, diverging from the handout's terminal-only Part 3).

## Context & decisions

- **Stack**: Vercel AI SDK track (ai 7.0.93, @ai-sdk/openai 4.0.59) — unchanged.
- **Current state**: `agent.ts` exports `runTurn` (generateText, non-streaming), `modelId()`, private `getModel()`, `SYSTEM_PROMPT`; `main.ts` REPL persists `canvas.json`, serves the web view via `server.ts`; `web/app.tsx` polls `/api/canvas` every 1.5s and renders Excalidraw.
- **Decision — keep `runTurn`**: Part 4's eval harness will use the non-streaming loop. Streaming replaces the REPL's turn function only.
- **Decision — presentation stays out of the loop**: `streamTurn` accepts optional `onTextDelta` / `onToolCall` callbacks; `main.ts` wires them to stdout printing AND the SSE bus. Streaming is a presentation concern (the handout's own lesson).
- **Decision — web streaming scope**: reply text + tool status via SSE only. Canvas updates keep the existing 1.5s polling (tools mutate the canvas mid-stream, so diagrams already appear before the turn ends). No two-way chat UI on the web page — input stays in the terminal.
- **Handout erratum carries over**: the Vercel snippet pushes `(await result.response).messages`, which in ai@7 is final-step-only. Use `await result.responseMessages` (the all-steps accumulator) — same fix as the Part 2 review.

## Tasks

1. **`agent.ts`** — export `getModel()` (make the private helper an export; `streaming.ts` needs it). No other changes.
2. **`streaming.ts`** (new) — `streamTurn(messages: ModelMessage[], canvas: Element[], opts?: { onTextDelta?: (t: string) => void; onToolCall?: (name: string) => void }): Promise<string>`:
   - `streamText({ model: getModel(), instructions: SYSTEM_PROMPT, messages, tools: makeTools(canvas), stopWhen: isStepCount(10) })`.
   - Iterate `result.fullStream`: `text-delta` parts → accumulate text + `onTextDelta(part.text)`; `tool-call` parts → `onToolCall(part.toolName)`; ignore other part types.
   - After the loop: `messages.push(...(await result.responseMessages))` (verify the property shape against `node_modules/ai/dist/index.d.ts` during implementation — it is `PromiseLike<ResponseMessage[]>` on streamText results).
   - Return the accumulated full text.
   - On a `fullStream` `error` part or thrown error: let it propagate — `main.ts` already catches and prints; also emit an error event on the bus (task 4).
3. **`server.ts`** — add SSE + event bus:
   - Export `type StreamEvent = { type: "delta"; text: string } | { type: "tool"; name: string } | { type: "end"; text: string } | { type: "error"; message: string }`.
   - Export `createBus()`: holds `Set<http.ServerResponse>` clients + `lastReply: string`; `emit(ev)` writes `data: ${JSON.stringify(ev)}\n\n` to every client (rescuing/dropping dead sockets) and records `end` events in `lastReply`; `attach(res)` registers a client and immediately replays `{ type: "end", text: lastReply }` when set (so a page refresh shows the last reply).
   - `startServer(canvas, port?, bus?)` gains a `/api/stream` route: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `res.flushHeaders()`, `bus.attach(res)`, a `: ping\n\n` keep-alive comment every ~20s, and cleanup (`clearInterval`, detach) on `req.on("close")`. Other routes unchanged.
4. **`main.ts`** — swap the turn function:
   - Import `streamTurn` from `./streaming.js`, `createBus` from `./server.js`.
   - `const bus = createBus(); startServer(canvas, undefined, bus);` (keep PORT env support).
   - Turn call becomes `streamTurn(messages, canvas, { onTextDelta: t => { process.stdout.write(t); bus.emit({ type: "delta", text: t }); }, onToolCall: n => { console.log(`\n ⚙ ${n} …`); bus.emit({ type: "tool", name: n }); } })`.
   - Do NOT reprint the full reply after the turn (text already streamed); print a blank line, then `bus.emit({ type: "end", text: reply })` — only when the turn succeeded.
   - Error path: `bus.emit({ type: "error", message: String(e) })` in addition to the existing `console.error`.
   - `renderSvg(canvas); saveCanvas(canvas);` after each turn — unchanged.
5. **`web/app.tsx`** — chat strip above the canvas:
   - Layout: flex column; a header `<div>` (fixed max-height ~20vh, overflow-y auto, monospace, small padding) above the Excalidraw container (flex: 1).
   - `const [lines, setLines] = useState<string[]>([])` + `useEffect` opening `new EventSource("/api/stream")`: `delta` appends to (or starts) the last line — deltas for one reply accumulate into a single growing line; `tool` appends `⚙ name …` as its own line; `end` replaces the accumulated reply text with the final full text and scrolls; `error` appends `⚠ message`; auto-scroll to bottom on update. Close the EventSource on unmount.
   - Keep the existing `/api/canvas` polling and `updateScene` logic untouched.

## Validation

- `npm run check` — typecheck clean.
- `npm run build:web` — bundle rebuilt.
- Piped smoke (no browser): `"draw a star" | npx tsx main.ts` — text deltas and `⚙ generate_diagram …` status print to the terminal; `canvas.json` updated; process exits cleanly at EOF.
- Manual (user-driven): `npm run dev` in your own terminal, open http://localhost:3457 — type a request in the terminal and watch: (a) words appear in the terminal as produced, (b) the web header streams the same words live, (c) `⚙ tool …` status lines appear in both, (d) the Excalidraw canvas updates mid-turn/after via polling, (e) refreshing the page replays the last reply.

## Risks / notes

- SSE behind no proxy here (direct localhost) — no buffering concerns; keep-alive pings handle idle timeouts.
- Multiple browser tabs: each gets its own SSE client; the bus broadcast handles N clients; late joiners get the last reply replay only.
- If the model produces no text (pure tool turn, empty `end`), send the `end` event anyway with empty text so the web clears/keeps state deterministically.
- DeepSeek endpoint: streaming with tool calls is standard OpenAI-compatible SSE; errors surface through the existing REPL catch.

## Out of scope

Part 4 (golden dataset + harness, non-streaming `runTurn` reused), Part 9 Gen UI (proper per-tool renderers), any web-side chat input, auth.
