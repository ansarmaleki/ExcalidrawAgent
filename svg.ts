// svg.ts — the visual payoff. After every agent turn we re-render the canvas
// to canvas.svg; keep it open in a browser tab and watch diagrams appear.
import fs from "node:fs";
import type { Element } from "./canvas.js";

const esc = (s: unknown) => String(s).replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export function svgString(canvas: Element[]): string {
  const parts: string[] = [];
  for (const el of canvas) {
    const { type: t, x, y } = el;
    const w = el.width ?? 0, h = el.height ?? 0;
    const stroke = esc(el.strokeColor ?? "#1e1e1e");
    const style = `fill="${esc(el.backgroundColor ?? "transparent")}" stroke="${stroke}" stroke-width="2"`;
    if (t === "rectangle")
      parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" ${style}/>`);
    else if (t === "ellipse")
      parts.push(`<ellipse cx="${x + w/2}" cy="${y + h/2}" rx="${w/2}" ry="${h/2}" ${style}/>`);
    else if (t === "diamond") {
      const pts = `${x + w/2},${y} ${x + w},${y + h/2} ${x + w/2},${y + h} ${x},${y + h/2}`;
      parts.push(`<polygon points="${pts}" ${style}/>`);
    } else if (t === "arrow" || t === "line") {
      const head = t === "arrow" ? ' marker-end="url(#head)"' : "";
      parts.push(`<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y + h}" ` +
        `stroke="${stroke}" stroke-width="2"${head}/>`);
    }
    if (el.text)
      parts.push(`<text x="${x + w/2}" y="${y + h/2}" text-anchor="middle" ` +
        `dominant-baseline="middle" font-size="${el.fontSize ?? 16}" ` +
        `font-family="sans-serif">${esc(el.text)}</text>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">` +
    `<defs><marker id="head" markerWidth="8" markerHeight="8" refX="7" refY="3" ` +
    `orient="auto"><path d="M0,0 L7,3 L0,6 z"/></marker></defs>${parts.join("\n")}</svg>`;
}

export function renderSvg(canvas: Element[], path = "canvas.svg"): void {
  fs.writeFileSync(path, svgString(canvas));
}
