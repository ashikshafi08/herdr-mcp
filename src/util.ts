import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config.js";
import { ToolError, type ToolErr } from "./runners.js";

export type ToolResult = {
  content: Array<{ type: "text"; text: string } | { type: "resource_link"; uri: string; name: string; mimeType?: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export function ok(summary: string, data: Record<string, unknown>, links: Array<{ path: string; name: string; mimeType?: string }> = []): ToolResult {
  return {
    content: [
      { type: "text", text: summary + "\n" + JSON.stringify(data, null, 1) },
      ...links.map((l) => ({ type: "resource_link" as const, uri: "file://" + l.path, name: l.name, mimeType: l.mimeType })),
    ],
    structuredContent: data,
  };
}

export function fail(e: ToolErr): ToolResult {
  const data = { error: e } as Record<string, unknown>;
  return { content: [{ type: "text", text: `Error ${e.code}: ${e.message}\nHint: ${e.hint}` }], structuredContent: data, isError: true };
}

export function err(code: string, message: string, hint: string): never {
  throw new ToolError({ code, message, hint });
}

/** Wrap a handler so it never throws a raw traceback to the client. */
export function safe<A>(fn: (a: A) => Promise<ToolResult>): (a: A) => Promise<ToolResult> {
  return async (a: A) => {
    try {
      return await fn(a);
    } catch (e) {
      if (e instanceof ToolError) return fail(e.err);
      const m = e instanceof Error ? e.message : String(e);
      return fail({ code: "internal_error", message: m, hint: "Unexpected herdr-mcp failure; check arguments or report this." });
    }
  };
}

export function writeTmp(name: string, content: string): string {
  fs.mkdirSync(config.tmpDir, { recursive: true });
  const safeName = name.replace(/[^A-Za-z0-9._-]/g, "_");
  const p = path.join(config.tmpDir, safeName);
  fs.writeFileSync(p, content);
  return p;
}

/** Cap text to max_chars keeping the TAIL (most recent output), optionally saving the full text. */
export function capTail(text: string, maxChars: number, saveName?: string, forceSave = false) {
  const truncated = text.length > maxChars;
  const out = truncated ? text.slice(text.length - maxChars) : text;
  const omitted_lines = truncated ? text.slice(0, text.length - maxChars).split("\n").length - 1 : 0;
  let full_path: string | undefined;
  if (saveName && (truncated || forceSave)) full_path = writeTmp(saveName, text);
  return { text: truncated ? `[…truncated ${text.length - maxChars} chars / ~${omitted_lines} lines…]\n` + out : out, truncated, omitted_lines, full_path };
}

/** Cap text keeping the HEAD (for diffs). */
export function capHead(text: string, maxChars: number) {
  const truncated = text.length > maxChars;
  return { text: truncated ? text.slice(0, maxChars) + `\n[…truncated ${text.length - maxChars} chars…]` : text, truncated };
}

export function hash(v: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);
}

export function shortId(prefix: string): string {
  return prefix + crypto.randomBytes(4).toString("hex");
}
