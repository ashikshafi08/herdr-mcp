import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config.js";
import { ToolError } from "./runners.js";
export function ok(summary, data, links = []) {
    return {
        content: [
            { type: "text", text: summary + "\n" + JSON.stringify(data, null, 1) },
            ...links.map((l) => ({ type: "resource_link", uri: "file://" + l.path, name: l.name, mimeType: l.mimeType })),
        ],
        structuredContent: data,
    };
}
export function fail(e) {
    const data = { error: e };
    return { content: [{ type: "text", text: `Error ${e.code}: ${e.message}\nHint: ${e.hint}` }], structuredContent: data, isError: true };
}
export function err(code, message, hint) {
    throw new ToolError({ code, message, hint });
}
/** Wrap a handler so it never throws a raw traceback to the client. */
export function safe(fn) {
    return async (a) => {
        try {
            return await fn(a);
        }
        catch (e) {
            if (e instanceof ToolError)
                return fail(e.err);
            const m = e instanceof Error ? e.message : String(e);
            return fail({ code: "internal_error", message: m, hint: "Unexpected herdr-mcp failure; check arguments or report this." });
        }
    };
}
export function writeTmp(name, content) {
    fs.mkdirSync(config.tmpDir, { recursive: true });
    const safeName = name.replace(/[^A-Za-z0-9._-]/g, "_");
    const p = path.join(config.tmpDir, safeName);
    fs.writeFileSync(p, content);
    return p;
}
/** Cap text to max_chars keeping the TAIL (most recent output), optionally saving the full text. */
export function capTail(text, maxChars, saveName, forceSave = false) {
    const truncated = text.length > maxChars;
    const out = truncated ? text.slice(text.length - maxChars) : text;
    const omitted_lines = truncated ? text.slice(0, text.length - maxChars).split("\n").length - 1 : 0;
    let full_path;
    if (saveName && (truncated || forceSave))
        full_path = writeTmp(saveName, text);
    return { text: truncated ? `[…truncated ${text.length - maxChars} chars / ~${omitted_lines} lines…]\n` + out : out, truncated, omitted_lines, full_path };
}
/** Cap text keeping the HEAD (for diffs). */
export function capHead(text, maxChars) {
    const truncated = text.length > maxChars;
    return { text: truncated ? text.slice(0, maxChars) + `\n[…truncated ${text.length - maxChars} chars…]` : text, truncated };
}
export function hash(v) {
    return crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);
}
export function shortId(prefix) {
    return prefix + crypto.randomBytes(4).toString("hex");
}
//# sourceMappingURL=util.js.map