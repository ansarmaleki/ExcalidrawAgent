// tools_v2.ts — the naive pair becomes five FOCUSED tools, plus a query tool
// that reads canvas state on demand. add is purely additive (it physically
// cannot clobber the canvas); update is batch; remove is explicit (the only
// path to losing an element); query replaces Part 6's every-turn canvas
// serialization — turns that don't need state don't pay for it. Example calls
// live INSIDE the descriptions — few-shot that travels with the tool.
import { tool } from "ai";
import { z } from "zod";
import { serializeCanvas } from "./context.js";
import { elementSchema } from "./tools.js";
import type { Element } from "./canvas.js";

export function makeToolsV2(canvas: Element[]) {
  return {
    add_elements: tool({
      description: 'Add new elements WITHOUT touching existing ones. Example: ' +
        '{"elements":[{"id":"rect_cache","type":"rectangle","x":340,"y":100,' +
        '"width":160,"height":80,"text":"Cache"}]}',
      inputSchema: z.object({ elements: z.array(elementSchema) }),
      execute: async ({ elements }) => {
        canvas.push(...(elements as Element[]));
        return `Added ${elements.length} elements.`;
      },
    }),
    update_elements: tool({
      description: 'Update one or MORE existing elements by id, in one call. ' +
        'Example: {"updates":[{"id":"rect_login","fields":{"backgroundColor":"#fa5252"}}]}',
      inputSchema: z.object({ updates: z.array(z.object({
        id: z.string(), fields: elementSchema.omit({ id: true }).partial() })) }),
      execute: async ({ updates }) => {
        const unknown: string[] = [];
        let applied = 0;
        for (const u of updates) {
          const el = canvas.find((e) => e.id === u.id);
          if (!el) { unknown.push(u.id); continue; }
          Object.assign(el, u.fields);
          applied++;
        }
        return `Applied ${applied} updates.` +
          (unknown.length ? ` Unknown ids: ${unknown.join(", ")}` : "");
      },
    }),
    remove_elements: tool({
      description: 'Remove elements by id. Call query_canvas first if unsure. ' +
        'Example: {"ids":["rect_old","arrow_stale"]}',
      inputSchema: z.object({ ids: z.array(z.string()) }),
      execute: async ({ ids }) => {
        const drop = new Set(ids);
        const keep = canvas.filter((el) => !drop.has(el.id));
        canvas.length = 0;
        canvas.push(...keep);
        return `Removed ${ids.length} elements.`;
      },
    }),
    query_canvas: tool({
      description: "Read the canvas: every element's id, type, label, position, " +
        "size. Call BEFORE modifying or removing. Never invent ids.",
      inputSchema: z.object({}),
      execute: async () => serializeCanvas(canvas),
    }),
  };
}
