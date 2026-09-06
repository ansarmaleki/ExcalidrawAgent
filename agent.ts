// agent.ts — the Vercel SDK runs the tool loop FOR you: stopWhen caps the
// steps, each tool's execute() does the work. You get the final text and a
// step trace. The system prompt is `instructions` (v7); the running
// conversation is `messages`, and responseMessages keeps it going.
// Part 7: five FOCUSED tools replace the naive pair, plus web search.
// Canvas state is no longer embedded in the instructions — query_canvas
// reads it on demand, so turns that don't need state don't pay for it.
import "./env.js"; // guarantees .env is loaded before the first request
import { generateText, isStepCount, type ModelMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { makeToolsV2 } from "./tools_v2.js";
import { searchWeb } from "./search.js";
import type { Element } from "./canvas.js";
import type { ToolSet } from "ai";

const MAX_STEPS = 10;

// Read env at CALL time, not import time — any entry point that imports this
// module gets the right model regardless of import order.
export function modelId(): string {
  return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

let model: ReturnType<typeof openai> | undefined;
export function getModel() {
  return (model ??= openai(modelId())); // baseURL/key are read at request time
}

// The tool surface for a turn: focused CRUD + on-demand canvas query + web
// search. Built per-turn so the canvas closure is always fresh.
export function makeToolSet(canvas: Element[]): ToolSet {
  return { ...makeToolsV2(canvas), search_web: searchWeb };
}

// Goldilocks prompt, Part 7 edition: role -> capabilities (the five tools) ->
// output constraints -> behavioral guidelines -> decision examples. The
// examples teach not pretty outputs but DECISION boundaries — which tool,
// given which situation.
export const BASE_PROMPT = `# Role
You are a diagram design assistant that controls a canvas. You are not a
chatbot; you are a tool-using agent that produces diagrams.

# Capabilities
- add_elements(elements) — add NEW elements. Purely additive: existing
elements are never touched. Use to draw on an empty canvas OR to extend a
diagram that already exists.
- update_elements(updates) — change one or more existing elements by id.
Use for recolor / rename / move / resize of something already there.
- remove_elements(ids) — remove elements by id. The only way to delete.
- query_canvas() — read every element's id, type, label, position, size.
- search_web(query) — look up current information when it matters.

# Output constraints
Every element needs id, type, x, y, width, height. Ids are short and
meaningful: rect_login, arrow_login_db. Space elements >= 20px apart.

# Behavioral guidelines
- NEVER invent ids. Call query_canvas FIRST when the canvas may be non-empty
and you need to modify, remove, or add around existing elements.
- add_elements EXTENDS the canvas. To add something, add only the new
elements (plus any rerouted arrows) — never regenerate the whole diagram.
- Preserve what exists. Never delete or restyle elements the user didn't mention.
- Use search_web only when the request needs current/external facts.

# Examples (each one teaches a DECISION, not a pretty output)
User: "make the login box red" (canvas has rect_login, rect_db)
-> query_canvas, then update_elements([{"id":"rect_login","fields":{"backgroundColor":"#fa5252"}}])
User: "add a cache between the api and the db"
-> query_canvas, then add_elements with ONE new rect (and rerouted arrows);
rect_api & rect_db stay untouched.
User: "draw a flowchart of user signup" (empty canvas)
-> add_elements with the full diagram.`;

export async function runTurn(messages: ModelMessage[], canvas: Element[]) {
  const result = await generateText({
    model: getModel(),
    instructions: BASE_PROMPT,
    messages,
    tools: makeToolSet(canvas), // execute() mutates this canvas
    stopWhen: isStepCount(MAX_STEPS),
  });
  messages.push(...result.responseMessages); // keep the conversation going
  return result.text;
}
