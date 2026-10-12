import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config.js";
import { hash } from "./util.js";
const runsFile = () => path.join(config.stateDir, "runs.jsonl");
const created = () => path.join(config.stateDir, "created.json");
let runs;
function load() {
    if (runs)
        return runs;
    runs = new Map();
    try {
        for (const line of fs.readFileSync(runsFile(), "utf8").split("\n")) {
            if (!line.trim())
                continue;
            try {
                const r = JSON.parse(line);
                runs.set(r.run_id, r);
            }
            catch {
                /* skip corrupt line */
            }
        }
    }
    catch {
        /* no file yet */
    }
    return runs;
}
export function saveRun(r) {
    r.updated_at = new Date().toISOString();
    load().set(r.run_id, r);
    fs.mkdirSync(config.stateDir, { recursive: true });
    fs.appendFileSync(runsFile(), JSON.stringify(r) + "\n");
    return r;
}
export function getRun(id) {
    return load().get(id);
}
export function listRuns() {
    return [...load().values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
export function findByKey(key, maxAgeMs) {
    const now = Date.now();
    return listRuns().find((r) => r.idempotency_key === key && (maxAgeMs === undefined || now - Date.parse(r.created_at) < maxAgeMs));
}
export function newRunId() {
    return "r" + crypto.randomBytes(3).toString("hex");
}
export function pushStatus(r, status) {
    if (r.status !== status)
        r.status_history.push({ at: new Date().toISOString(), status });
    r.status = status;
}
function loadCreated() {
    try {
        return JSON.parse(fs.readFileSync(created(), "utf8"));
    }
    catch {
        return { workspaces: [], panes: [] };
    }
}
export function markCreated(kind, id) {
    const c = loadCreated();
    if (!c[kind].includes(id))
        c[kind].push(id);
    fs.mkdirSync(config.stateDir, { recursive: true });
    fs.writeFileSync(created(), JSON.stringify(c));
}
export function isCreated(kind, id) {
    return loadCreated()[kind].includes(id);
}
/* ---- One-time approval tokens (in memory; a restart invalidates pending previews) ---- */
const tokens = new Map();
export function issueToken(tool, args) {
    const t = "apv_" + crypto.randomBytes(8).toString("hex");
    tokens.set(t, { tool, argsHash: hash(args), expires: Date.now() + config.approvalTtlMs });
    return t;
}
/** Consumes the token if valid for this exact tool + args. */
export function consumeToken(tool, args, token) {
    if (!token)
        return false;
    const rec = tokens.get(token);
    if (!rec)
        return false;
    tokens.delete(token);
    return rec.tool === tool && rec.argsHash === hash(args) && rec.expires > Date.now();
}
//# sourceMappingURL=store.js.map