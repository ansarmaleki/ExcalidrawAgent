// search.ts — a network tool for current information. Two rules every
// network tool must follow: errors RETURN (never raise — a thrown exception
// kills the loop) and results are CONDENSED before they go back (every byte
// returned is tokens on every later turn). Backend: DuckDuckGo Instant
// Answers, keyless — this stack has no OpenAI key for hosted web_search.
import { tool } from "ai";
import { z } from "zod";

type DDGResponse = {
  AbstractText?: string;
  RelatedTopics?: { Text?: string }[];
};

export const searchWeb = tool({
  description: "Search the web for current information and return a short summary.",
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }): Promise<string> => {
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}` +
        `&format=json&no_html=1&skip_disambig=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return JSON.stringify({ error: `HTTP ${res.status}` });
      const data = (await res.json()) as DDGResponse;
      const bits: string[] = [];
      if (data.AbstractText) bits.push(data.AbstractText);
      for (const t of data.RelatedTopics ?? []) {
        if (t.Text) bits.push(t.Text.slice(0, 300));
        if (bits.length >= 6) break;
      }
      return JSON.stringify({ results: bits.join(" | ").slice(0, 2000) || "No results." });
    } catch (e) {
      return JSON.stringify({ error: String(e) }); // the agent reads and adapts
    }
  },
});
