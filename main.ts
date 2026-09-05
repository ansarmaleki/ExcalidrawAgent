// main.ts — the REPL: every turn runs the agent against the shared canvas,
// prints the reply, and re-renders canvas.svg so a browser tab open on it
// shows the live diagram. The system prompt rides along as `instructions`
// inside runTurn, so the message history starts empty.
import "./env.js"; // loads .env before anything reads process.env
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { ModelMessage } from "ai";
import { runTurn, modelId } from "./agent.js";
import { renderSvg } from "./svg.js";
import type { Element } from "./canvas.js";

if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "sk-REPLACE_ME") {
  console.error("Missing API key: put OPENAI_API_KEY=sk-... in .env (see .env for the placeholder).");
  process.exit(1);
}

const canvas: Element[] = [];
const messages: ModelMessage[] = [];
renderSvg(canvas); // start with an empty canvas on disk

const rl = readline.createInterface({ input: stdin, output: stdout });
console.log("Diagram agent ready. Type a request, or 'exit' to quit.");
console.log(`Endpoint: ${process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"} | Model: ${modelId()}`);
console.log("Keep canvas.svg open in a browser and refresh after each turn.\n");

while (true) {
  const user = (await rl.question("> ")).trim();
  if (user === "exit" || user === "quit") break;
  if (!user) continue;
  messages.push({ role: "user", content: user });
  try {
    const reply = await runTurn(messages, canvas);
    console.log(`\n${reply}\n`);
  } catch (e) {
    console.error(`\nError: ${e}\n`);
  }
  renderSvg(canvas);
}

rl.close();
