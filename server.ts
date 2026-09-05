// server.ts — serves the live Excalidraw canvas: the web page, the esbuild
// bundle, /api/canvas returning the agent's canvas JSON (the same array the
// REPL mutates, serialized at request time), and /api/stream pushing live
// agent events (text deltas, tool status, turn end) to the browser via SSE.
// Framework-free on purpose.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import type { Element } from "./canvas.js";

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "tool"; name: string }
  | { type: "end"; text: string }
  | { type: "error"; message: string };

export function createBus() {
  const clients = new Set<http.ServerResponse>();
  let lastReply = "";
  return {
    attach(res: http.ServerResponse) {
      clients.add(res);
      if (lastReply) res.write(`data: ${JSON.stringify({ type: "end", text: lastReply } as StreamEvent)}\n\n`);
    },
    detach(res: http.ServerResponse) {
      clients.delete(res);
    },
    emit(ev: StreamEvent) {
      if (ev.type === "end") lastReply = ev.text;
      const frame = `data: ${JSON.stringify(ev)}\n\n`;
      for (const res of clients) {
        try {
          res.write(frame);
        } catch {
          clients.delete(res); // dead socket — drop it
        }
      }
    },
  };
}

export type Bus = ReturnType<typeof createBus>;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
};

// source layout (server.ts at root) and compiled layout (dist/server.js,
// web/ and public/ one level up) — first existing wins.
const roots = [import.meta.dirname, path.join(import.meta.dirname, "..")];
const webDir = roots.map((r) => path.join(r, "web"))
  .find((d) => fs.existsSync(path.join(d, "index.html")))
  ?? path.join(import.meta.dirname, "web");
const publicDir = roots.map((r) => path.join(r, "public"))
  .find((d) => fs.existsSync(d))
  ?? path.join(import.meta.dirname, "public");

function serveFile(res: http.ServerResponse, file: string): void {
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

export function startServer(canvas: Element[], port = Number(process.env.PORT ?? 3457), bus = createBus()) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname === "/api/canvas") {
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ elements: canvas }));
      return;
    }
    if (url.pathname === "/api/stream") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      });
      res.flushHeaders();
      res.write(": connected\n\n");
      bus.attach(res);
      const ping = setInterval(() => {
        try {
          res.write(": ping\n\n"); // keep-alive comment, ignored by EventSource
        } catch {
          /* cleanup below fires via close event */
        }
      }, 20_000);
      req.on("close", () => {
        clearInterval(ping);
        bus.detach(res);
      });
      return;
    }
    if (url.pathname === "/") {
      const file = path.join(webDir, "index.html");
      if (fs.existsSync(file)) return serveFile(res, file);
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("index.html not found — run `npm run build:web`");
      return;
    }
    // static assets from public/, refusing anything that escapes the dir
    const file = path.resolve(publicDir, "." + path.sep + url.pathname.slice(1));
    if (file.startsWith(publicDir + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile())
      return serveFile(res, file);
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  });
  server.on("error", (e) => console.error(`Web server error: ${e.message}`));
  server.listen(port, () => console.log(`Live canvas: http://localhost:${port} (open in a browser)`));
  return server;
}
