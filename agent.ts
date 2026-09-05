// agent.ts — the Vercel SDK runs the tool loop FOR you: stopWhen caps the
// steps, each tool's execute() does the work. You get the final text and a
// step trace. The system prompt is `instructions` (v7); the running
// conversation is `messages`, and responseMessages keeps it going.
import "./env.js"; // guarantees .env is loaded before the first request
import { generateText, isStepCount, type ModelMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { makeTools } from "./tools.js";
import type { Element } from "./canvas.js";

const MAX_STEPS = 10;

// Read env at CALL time, not import time — any entry point that imports this
// module gets the right model regardless of import order.
export function modelId(): string {
  return process.env.OPENAI_MODEL!;
}

let model: ReturnType<typeof openai> | undefined;
function getModel() {
  return (model ??= openai(modelId())); // baseURL/key are read at request time
}

export const SYSTEM_PROMPT = `You are a diagram design assistant controlling a canvas.
Use generate_diagram to create diagrams and modify_diagram to tweak elements.
Give every element a unique id. Space elements at least 20px apart.
Lay flows out left-to-right or top-to-bottom.`;

export async function runTurn(messages: ModelMessage[], canvas: Element[]) {
  const result = await generateText({
    model: getModel(),
    instructions: SYSTEM_PROMPT,
    messages,
    tools: makeTools(canvas), // execute() mutates this canvas
    stopWhen: isStepCount(MAX_STEPS),
  });
  messages.push(...result.responseMessages); // keep the conversation going
  return result.text;
}
