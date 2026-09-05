// streaming.ts — streamText yields a fullStream of typed parts. Print
// text-delta as it lands; announce tool-call the instant it arrives. Because
// the SDK runs the loop, "streaming" and "the turn" are one call here.
// Presentation stays OUT of the loop: callers pass onTextDelta / onToolCall
// callbacks (terminal printing, SSE bus, or nothing — the eval harness of
// Part 4 will keep using runTurn).
import { streamText, isStepCount, type ModelMessage } from "ai";
import { getModel, SYSTEM_PROMPT } from "./agent.js";
import { makeTools } from "./tools.js";
import type { Element } from "./canvas.js";

const MAX_STEPS = 10;

export type StreamCallbacks = {
  onTextDelta?: (text: string) => void;
  onToolCall?: (name: string) => void;
};

export async function streamTurn(
  messages: ModelMessage[],
  canvas: Element[],
  opts: StreamCallbacks = {},
): Promise<string> {
  const result = streamText({
    model: getModel(),
    instructions: SYSTEM_PROMPT,
    messages,
    tools: makeTools(canvas), // execute() mutates this canvas
    stopWhen: isStepCount(MAX_STEPS),
  });

  let text = "";
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      text += part.text;
      opts.onTextDelta?.(part.text);
    } else if (part.type === "tool-call") {
      opts.onToolCall?.(part.toolName);
    }
    // other part types (reasoning, sources, errors…) are ignored; thrown
    // errors propagate to the caller, which already catches and reports
  }

  messages.push(...(await result.responseMessages)); // keep the conversation going
  return text;
}
