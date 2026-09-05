// compaction.ts — keep the last 4 messages verbatim; tell the summarizer to
// preserve element ids VERBATIM, or later modify_diagram calls break (the
// tool-call history is the only other place ids live, and the summary
// replaces it). Part 6 tuning of Week 1's compactor.
import { generateText, type ModelMessage } from "ai";
import { getModel } from "./agent.js";

const THRESHOLD_CHARS = 32_000; // ~8K tokens. Cheap heuristic, good enough.
const KEEP_LAST = 4;

export async function compactHistory(messages: ModelMessage[]): Promise<ModelMessage[]> {
  const size = messages.reduce((n, m) => n + JSON.stringify(m).length, 0);
  if (size < THRESHOLD_CHARS) return [...messages];
  const old = messages.slice(0, -KEEP_LAST);
  const recent = messages.slice(-KEEP_LAST);
  const { text } = await generateText({
    model: getModel(),
    instructions: "Compress this conversation into a terse paragraph. Preserve " +
      "every decision the user made and every element id VERBATIM. No preamble.",
    prompt: old.map((m) => JSON.stringify(m)).join("\n"),
  });
  // v7 rejects a `system` role inside the messages array unless you opt in,
  // so the summary re-enters as a leading user note.
  return [{ role: "user", content: `[Earlier conversation summary] ${text}` }, ...recent];
}
