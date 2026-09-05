// context.ts — the canvas, summarized for the model: ids, labels, positions,
// sizes. ~300 chars for a 5-element diagram instead of kilobytes of raw JSON.
// Coordinates matter: "add a cache BETWEEN api and db" needs to know where
// api and db actually are.
import type { Element } from "./canvas.js";

export function serializeCanvas(canvas: Element[]): string {
  if (!canvas.length) return "Canvas is empty.";
  const lines: string[] = [];
  const counts: Record<string, number> = {};
  for (const el of canvas) {
    counts[el.type] = (counts[el.type] ?? 0) + 1;
    const label = el.text ? ` "${el.text}"` : "";
    const pos = ` at (${Math.round(el.x)}, ${Math.round(el.y)})`;
    const size = ` ${Math.round(el.width ?? 0)}x${Math.round(el.height ?? 0)}`;
    lines.push(`- ${el.type} ${el.id}${label}${pos}${size}`);
  }
  const summary = Object.entries(counts)
    .map(([t, n]) => `${n} ${t}${n > 1 ? "s" : ""}`).join(", ");
  return `Canvas contains ${summary}:\n${lines.join("\n")}`;
}

export function buildSystem(basePrompt: string, canvas: Element[]): string {
  return `${basePrompt}\n\n# Current canvas state\n\n${serializeCanvas(canvas)}`;
}
