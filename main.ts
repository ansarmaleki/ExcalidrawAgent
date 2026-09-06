// main.ts — the REPL: every turn runs the agent against the shared canvas
// with STREAMING text and live tool status (Part 3), re-renders canvas.svg,
// saves the canvas to canvas.json (reloaded on restart so the web view keeps
// the diagram), and serves the live Excalidraw view at http://localhost:3457
// with the reply streamed to the browser over SSE. The system prompt rides
// along as `instructions` inside streamTurn, so the message history starts empty.
import "./env.js"; // loads .env before anything reads process.env
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { ModelMessage } from "ai";
import { modelId } from "./agent.js";
import { streamTurn } from "./streaming.js";
import { compactHistory } from "./compaction.js";
import { renderSvg } from "./svg.js";
import { startServer, createBus } from "./server.js";
import type { Element } from "./canvas.js";

if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "sk-REPLACE_ME") {
  console.error("Missing API key: put OPENAI_API_KEY=sk-... in .env (see .env for the placeholder).");
  process.exit(1);
}

// canvas.json lives next to this module (root in dev, dist/ when built);
// on load, the compiled layout also falls back to the project root.
const canvasPaths = [
  path.join(import.meta.dirname, "canvas.json"),
  path.join(import.meta.dirname, "..", "canvas.json"),
];
const canvasFile = canvasPaths[0];

function loadCanvas(): Element[] {
  for (const p of canvasPaths) {
    try {
      if (!fs.existsSync(p)) continue;
      const els = JSON.parse(fs.readFileSync(p, "utf8"));
      if (Array.isArray(els)) return els;
    } catch { /* unreadable file — start empty */ }
  }
  return [];
}
function saveCanvas(canvas: Element[]): void {
  fs.writeFileSync(canvasFile, JSON.stringify(canvas, null, 2));
}

const canvas: Element[] = loadCanvas();
let messages: ModelMessage[] = []; // compactHistory returns a new array
const bus = createBus();
renderSvg(canvas);
if (canvas.length) console.log(`Restored ${canvas.length} elements from canvas.json`);
const server = startServer(canvas, undefined, bus); // live view + SSE stream

const rl = readline.createInterface({ input: stdin, output: stdout });

// Buffer ALL incoming lines ourselves: rl.question() only listens for the
// next line, so input arriving while a turn is in flight (piped stdin) would
// be dropped by readline. A line queue + explicit close signal fixes both
// piped and interactive modes.
const pending: string[] = [];
let lineResolve: ((v: string | null) => void) | null = null;
rl.on("line", (line) => {
  if (lineResolve) { const r = lineResolve; lineResolve = null; r(line); }
  else pending.push(line);
});
rl.on("close", () => {
  if (lineResolve) { const r = lineResolve; lineResolve = null; r(null); }
});
function nextLine(): Promise<string | null> {
  const buffered = pending.shift();
  if (buffered !== undefined) return Promise.resolve(buffered);
  return new Promise((res) => { lineResolve = res; });
}

console.log("Diagram agent ready. Type a request, or 'exit' to quit.");
console.log(`Endpoint: ${process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"} | Model: ${modelId()}`);
console.log("Excalidraw view updates every ~1.5s; canvas.svg is still written each turn.\n");

while (true) {
  const raw = await nextLine();
  if (raw === null) break; // stdin closed (piped input) — exit cleanly
  const user = raw.trim();
  if (user === "exit" || user === "quit") break;
  if (!user) continue;
  process.stdout.write("\n");
  messages.push({ role: "user", content: user });
  try {
    messages = await compactHistory(messages); // Part 6: ids preserved in summary
    const reply = await streamTurn(messages, canvas, {
      onTextDelta: (t) => { process.stdout.write(t); bus.emit({ type: "delta", text: t }); },
      onToolCall: (n) => {
        console.log(`\n ⚙ ${n} …`);
        bus.emit({ type: "tool", name: n });
      },
    });
    console.log("\n"); // the reply already streamed — just close the line
    bus.emit({ type: "end", text: reply });
  } catch (e) {
    console.error(`\nError: ${e}\n`);
    bus.emit({ type: "error", message: String(e) });
  }
  renderSvg(canvas);
  saveCanvas(canvas);
}

rl.close();
server.close(); // the listening socket keeps the event loop alive otherwise
process.exit(0);
