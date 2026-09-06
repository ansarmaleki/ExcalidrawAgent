// tools.ts — Vercel tools are objects with a zod inputSchema and an execute()
// that runs when the model calls them. execute() IS the dispatch — no separate
// table. A factory binds them to a canvas the harness can swap out.
import { tool } from "ai";
import { z } from "zod";
import { applyGenerate, applyModify, type Element } from "./canvas.js";

export const elementSchema = z.object({
  id: z.string().describe("Unique id, e.g. 'rect_login'"),
  type: z.enum(["rectangle", "ellipse", "diamond", "text", "arrow", "line"]),
  x: z.number(), y: z.number(), width: z.number(), height: z.number(),
  text: z.string().optional(),
  strokeColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  fontSize: z.number().optional(),
});

export function makeTools(canvas: Element[]) {
  return {
    generate_diagram: tool({
      description: "Create a complete diagram as an array of elements. Use when " +
        "the user asks you to create, draw or design something new.",
      inputSchema: z.object({ elements: z.array(elementSchema) }),
      execute: async ({ elements }) => applyGenerate(canvas, elements),
    }),
    modify_diagram: tool({
      description: "Change ONE existing element by id. Only pass fields to change.",
      inputSchema: z.object({
        element_id: z.string(),
        updates: elementSchema.partial().omit({ id: true }),
      }),
      execute: async ({ element_id, updates }) =>
        applyModify(canvas, element_id, updates),
    }),
  };
}
