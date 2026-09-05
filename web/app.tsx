// web/app.tsx — the browser half of the diagram agent: renders the agent's
// canvas in a real Excalidraw editor and polls the local server (/api/canvas)
// so diagrams appear live as the agent draws them. The agent's Element[] model
// maps onto Excalidraw "skeleton" elements and convertToExcalidrawElements
// fills in the rest.
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Excalidraw, convertToExcalidrawElements } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { Element } from "../canvas.js";

// Derive the SDK's own types from its exports (ExcalidrawImperativeAPI and
// ExcalidrawElementSkeleton are not re-exported at the package root).
type Skeleton = Exclude<Parameters<typeof convertToExcalidrawElements>[0], null>[number];
type Api = Parameters<NonNullable<React.ComponentProps<typeof Excalidraw>["excalidrawAPI"]>>[0];

function toSkeletons(elements: Element[]): Skeleton[] {
  return elements.map((el) => {
    if (el.type === "arrow" || el.type === "line") {
      // our arrows are (x,y) -> (x+width, y+height); excalidraw linear
      // elements are (x,y) plus relative points starting at [0,0]
      const points: [number, number][] = [[0, 0], [el.width, el.height]];
      return { type: el.type, x: el.x, y: el.y, points, strokeColor: el.strokeColor };
    }
    if (el.type === "text")
      return { type: "text", x: el.x, y: el.y, text: el.text ?? "", strokeColor: el.strokeColor, fontSize: el.fontSize };
    const base = {
      type: el.type, x: el.x, y: el.y, width: el.width, height: el.height,
      strokeColor: el.strokeColor, backgroundColor: el.backgroundColor,
    };
    return el.text ? { ...base, label: { text: el.text, fontSize: el.fontSize } } : base;
  });
}

function App() {
  const [api, setApi] = useState<Api | null>(null);

  useEffect(() => {
    if (!api) return;
    let last = "";
    const tick = async () => {
      try {
        const r = await fetch("/api/canvas", { cache: "no-store" });
        const data: { elements: Element[] } = await r.json();
        if (!Array.isArray(data.elements)) return;
        const json = JSON.stringify(data.elements);
        if (json === last) return; // no change — don't clobber the scene
        last = json;
        api.updateScene({ elements: convertToExcalidrawElements(toSkeletons(data.elements)) });
      } catch {
        // server not up yet or restarting — retry on the next tick
      }
    };
    const timer = setInterval(tick, 1500);
    void tick();
    return () => clearInterval(timer);
  }, [api]);

  return (
    <div style={{ height: "100vh" }}>
      <Excalidraw excalidrawAPI={setApi} theme="light" />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
