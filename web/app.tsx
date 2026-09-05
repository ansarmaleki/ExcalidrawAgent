// web/app.tsx — the browser half of the diagram agent: renders the agent's
// canvas in a real Excalidraw editor and polls the local server (/api/canvas)
// so diagrams appear live as the agent draws them. The agent's Element[] model
// maps onto Excalidraw "skeleton" elements and convertToExcalidrawElements
// fills in the rest. Above the editor, /api/stream (SSE) shows the reply
// streaming in real time, with live tool status lines (Part 3).
import { useEffect, useRef, useState } from "react";
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

// SSE events pushed by server.ts (kept in sync with the StreamEvent type)
type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "tool"; name: string }
  | { type: "end"; text: string }
  | { type: "error"; message: string };

// One rendered chat line: either a text chunk or a status line
type Line = { kind: "text" | "tool" | "error"; text: string };

function useStreamLines(): Line[] {
  const [lines, setLines] = useState<Line[]>([]);
  const streamingIdxRef = useRef(-1); // line currently accumulating deltas

  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onmessage = (ev: MessageEvent<string>) => {
      let msg: StreamEvent;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      setLines((prev) => {
        const lines = [...prev];
        const idx = streamingIdxRef.current;
        switch (msg.type) {
          case "delta":
            if (idx >= 0 && lines[idx]?.kind === "text") {
              lines[idx] = { kind: "text", text: lines[idx].text + msg.text };
            } else {
              streamingIdxRef.current = lines.length;
              lines.push({ kind: "text", text: msg.text });
            }
            break;
          case "tool":
            streamingIdxRef.current = -1; // next delta starts a fresh line
            lines.push({ kind: "tool", text: `⚙ ${msg.name} …` });
            break;
          case "end":
            streamingIdxRef.current = -1;
            if (msg.text && lines[idx]?.kind === "text") {
              lines[idx] = { kind: "text", text: msg.text }; // final authoritative text
            } else if (msg.text) {
              lines.push({ kind: "text", text: msg.text });
            }
            break;
          case "error":
            streamingIdxRef.current = -1;
            lines.push({ kind: "error", text: `⚠ ${msg.message}` });
            break;
        }
        return lines;
      });
    };
    return () => es.close();
  }, []);

  return lines;
}

function ChatHeader({ lines }: { lines: Line[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [lines]);
  if (!lines.length) return null;
  return (
    <div
      ref={ref}
      style={{
        maxHeight: "20vh", overflowY: "auto", padding: "8px 12px",
        fontFamily: "ui-monospace, monospace", fontSize: 12, lineHeight: 1.5,
        borderBottom: "1px solid #e0e0e0", background: "#fafafa", whiteSpace: "pre-wrap",
      }}
    >
      {lines.map((line, i) => (
        <div key={i} style={{
          color: line.kind === "tool" ? "#888" : line.kind === "error" ? "#c92a2a" : "#1e1e1e",
        }}>
          {line.text}
        </div>
      ))}
    </div>
  );
}

function App() {
  const [api, setApi] = useState<Api | null>(null);
  const lines = useStreamLines();

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
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <ChatHeader lines={lines} />
      <div style={{ flex: 1, minHeight: 0 }}>
        <Excalidraw excalidrawAPI={setApi} theme="light" />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
