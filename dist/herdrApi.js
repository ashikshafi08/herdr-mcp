/** Thin typed helpers over the herdr CLI (Phase 1). Phase 2 (socket events.subscribe) is a TODO, see IMPLEMENTATION-NOTES.md. */
import { herdr, ToolError } from "./runners.js";
export const PANE_ID_RE = /^w[0-9A-Za-z]+:p[0-9A-Za-z]+$/;
export const SETTLED = ["idle", "done", "blocked"];
export async function snapshot() {
    const r = await herdr(["api", "snapshot"]);
    return r.snapshot ?? r;
}
export async function getAgent(target) {
    const r = await herdr(["agent", "get", target]);
    return r.agent ?? r;
}
export async function readAgent(target, source, lines) {
    const r = await herdr(["agent", "read", target, "--source", source, "--lines", String(lines), "--format", "text"]);
    return extractText(r);
}
export async function readPane(paneId, source, lines) {
    const r = await herdr(["pane", "read", paneId, "--source", source, "--lines", String(lines), "--format", "text"]);
    return extractText(r);
}
function extractText(r) {
    if (typeof r?.text === "string")
        return r.text;
    if (typeof r?.read?.text === "string")
        return r.read.text;
    if (typeof r?.content === "string")
        return r.content;
    return JSON.stringify(r);
}
/** agent wait; a herdr `timeout` is a normal outcome => {timedOut:true}. */
export async function waitAgent(target, until, timeoutMs) {
    const args = ["agent", "wait", target];
    for (const u of until)
        args.push("--until", u);
    args.push("--timeout", String(timeoutMs));
    try {
        const r = await herdr(args, { timeoutMs: timeoutMs + 15_000 });
        return { agent: r.agent ?? r, timedOut: false };
    }
    catch (e) {
        if (e instanceof ToolError && (e.err.code === "timeout" || /timed? ?out/i.test(e.err.message)))
            return { timedOut: true };
        throw e;
    }
}
export function paneIdFrom(r) {
    return r?.pane?.pane_id ?? r?.pane_id ?? r?.root_pane?.pane_id ?? r?.pane_info?.pane_id ?? r?.info?.pane_id;
}
export function agentSummary(a) {
    return {
        name: a?.name ?? null,
        kind: a?.agent ?? null,
        pane_id: a?.pane_id ?? null,
        workspace_id: a?.workspace_id ?? null,
        status: a?.agent_status ?? "unknown",
        cwd: a?.cwd ?? null,
        title: a?.terminal_title_stripped ?? null,
    };
}
//# sourceMappingURL=herdrApi.js.map