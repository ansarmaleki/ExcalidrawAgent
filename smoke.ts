// smoke.ts — offline check of canvas mutation + SVG rendering (no API calls).
// Assertions throw (node:assert/strict), so a regression fails the process.
import assert from "node:assert/strict";
import { applyGenerate, applyModify, type Element } from "./canvas.js";
import { svgString } from "./svg.js";

const canvas: Element[] = [];

const elements: Element[] = [
  { id: "rect_start", type: "rectangle", x: 100, y: 100, width: 160, height: 60, text: "Start" },
  { id: "rect_proc", type: "rectangle", x: 400, y: 100, width: 160, height: 60, text: "Process" },
  { id: "rect_end", type: "rectangle", x: 700, y: 100, width: 160, height: 60, text: "End" },
  { id: "arrow_1", type: "arrow", x: 260, y: 130, width: 140, height: 0 },
  { id: "arrow_2", type: "arrow", x: 560, y: 130, width: 140, height: 0 },
  // hostile fixtures: text and attributes that must come out escaped
  { id: "rect_evil", type: "rectangle", x: 950, y: 100, width: 160, height: 60,
    text: '<script>&"', strokeColor: 'a" onload="alert(1)' },
];

console.log(applyGenerate(canvas, elements));
assert.equal(canvas.length, 6);
assert.equal(canvas[0].text, "Start");

// tool args arrive as JSON, so nulls are possible at runtime even though the
// static type won't admit them — applyModify must skip them.
const nullUpdates: Record<string, unknown> = { backgroundColor: "#fa5252", text: null };
console.log(applyModify(canvas, "rect_start", nullUpdates as Partial<Element>));
assert.equal(canvas[0].backgroundColor, "#fa5252");
assert.equal(canvas[0].text, "Start");

console.log(applyModify(canvas, "nope", { text: "x" }));
assert.ok(canvas.every((el) => el.id !== "nope"));

const svg = svgString(canvas);
assert.ok(svg.includes('<rect x="100" y="100"'), "rect rendered");
assert.ok(svg.includes('marker-end="url(#head)"'), "arrowheads present");
assert.ok(svg.includes(">Start<"), "label rendered");
assert.ok(svg.includes('marker id="head"'), "arrowhead defs present");

// escaping: raw payloads must not survive; escaped forms must
assert.ok(svg.includes("&lt;script&gt;&amp;&quot;"), "text payload escaped");
assert.ok(!svg.includes("<script"), "no raw script tag");
assert.ok(svg.includes("a&quot; onload=&quot;alert(1)"), "color payload escaped");
assert.ok(!svg.includes('" onload="'), "no attribute breakout");

console.log("SVG bytes:", svg.length);
console.log("ALL SMOKE TESTS PASSED");
