// agent.ts — the Vercel SDK runs the tool loop FOR you: stopWhen caps the
// steps, each tool's execute() does the work. You get the final text and a
// step trace. The system prompt is `instructions` (v7); the running
// conversation is `messages`, and responseMessages keeps it going.
// Part 6: the instructions are now the structured BASE_PROMPT plus the
// CURRENT canvas state, rebuilt at call time — the model always sees fresh
// ids/positions, so modify calls never depend on stale history.
import "./env.js"; // guarantees .env is loaded before the first request
import { generateText, isStepCount, type ModelMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { makeTools } from "./tools.js";
import { buildSystem } from "./context.js";
import type { Element } from "./canvas.js";

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

// The Goldilocks prompt: role -> capabilities -> output constraints ->
// behavioral guidelines -> few-shot examples. The examples teach not pretty
// outputs but DECISION boundaries — which tool, given which canvas state.
export const BASE_PROMPT = `# Role
You are a diagram design assistant that controls a canvas. You are not a
chatbot; you are a tool-using agent that produces diagrams.

# Capabilities
- generate_diagram(elements) — produce a full diagram. Use when the canvas is
empty, or the user wants something brand new / replaced from scratch.
- modify_diagram(element_id, updates) — change ONE existing element by id.
Use for recolor / rename / move / resize of something already there.

# Output constraints
Every element needs id, type, x, y, width, height. Ids are short and
meaningful: rect_login, arrow_login_db. Space elements >= 20px apart.

# Behavioral guidelines
- USE THE CANVAS STATE. If the canvas is non-empty, its summary is in this
prompt. Never invent ids.
- Prefer modify_diagram for tweaks. "Make the login box red" must NOT
regenerate the whole canvas.
- Preserve what exists. Never delete or restyle elements the user didn't mention.

# Examples (each one teaches a DECISION, not a pretty output)
User: "make the login box red" Canvas: rect_login ("Login"), rect_db ("DB")
-> modify_diagram("rect_login", {"backgroundColor": "#fa5252"})
User: "add a cache between the api and the db"
-> generate_diagram with ONE new rect + rerouted arrows; rect_api & rect_db stay.`;

export async function runTurn(messages: ModelMessage[], canvas: Element[]) {
  const result = await generateText({
    model: getModel(),
    instructions: buildSystem(BASE_PROMPT, canvas), // fresh state every turn
    messages,
    tools: makeTools(canvas), // execute() mutates this canvas
    stopWhen: isStepCount(MAX_STEPS),
  });
  messages.push(...result.responseMessages); // keep the conversation going
  return result.text;
}
