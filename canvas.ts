// canvas.ts — the canvas is just an array of plain objects. That's the whole
// data model: no database, no framework, trivially serializable.
export type Element = {
  id: string;
  type: "rectangle" | "ellipse" | "diamond" | "text" | "arrow" | "line";
  x: number; y: number; width: number; height: number;
  text?: string; strokeColor?: string; backgroundColor?: string; fontSize?: number;
};

export function applyGenerate(canvas: Element[], elements: Element[]): string {
  canvas.length = 0; // replace everything
  canvas.push(...elements.map((el) => ({ ...el })));
  return `Canvas replaced: ${elements.length} elements.`;
}

export function applyModify(canvas: Element[], elementId: string,
  updates: Partial<Element>): string {
  const el = canvas.find((e) => e.id === elementId);
  if (!el) return `No element with id "${elementId}" on the canvas.`;
  for (const [k, v] of Object.entries(updates))
    if (v != null) (el as Record<string, unknown>)[k] = v;
  return `Updated ${elementId}.`;
}
