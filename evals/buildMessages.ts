// evals/buildMessages.ts — same fake history as ModelMessage parts. The assistant
// makes a tool-call part; the tool role answers with a matching tool-result.
// No system message: on the Vercel track the system prompt rides along as
// `instructions` inside runTurn, not in the message array.
import type { ModelMessage } from "ai";

export type Case = {
  id: string;
  input: string;
  expectedCharacteristics: string[];
  difficulty: string;
  category: string;
  seed?: {
    userPrompt: string;
    assistantConfirmation: string;
    elements: unknown[];
  };
  preservedIds?: string[];
  expectedKeywords?: string[];
};

export function buildMessages(c: Case): ModelMessage[] {
  const seed = c.seed;
  if (!seed) return [{ role: "user", content: c.input }]; // create case: one user turn
  const id = `seed_${c.id}`;
  return [
    { role: "user", content: seed.userPrompt },
    { role: "assistant", content: [{ type: "tool-call", toolCallId: id,
      toolName: "generate_diagram", input: { elements: seed.elements } }] },
    { role: "tool", content: [{ type: "tool-result", toolCallId: id,
      toolName: "generate_diagram", output: { type: "text",
        value: `Canvas replaced: ${seed.elements.length} elements.` } }] },
    { role: "assistant", content: seed.assistantConfirmation },
    { role: "user", content: c.input }, // the actual test
  ];
}
