import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config.js";
import { hash } from "./util.js";

export interface RunRecord {
  run_id: string;
  created_at: string;
  updated_at: string;
  idempotency_key?: string;
  source: "task" | "prompt" | "pane_run";
  repo_path?: string;
  workspace_id?: string;
  pane_id?: string;
  agent_name?: string;
  agent_kind?: string;
  worktree_path?: string;
  branch?: string;
  base?: string;
  prompt_hash?: string;
  argv?: string[];
  status?: string;
  status_history: Array<{ at: string; status: string }>;
  steps?: Array<{ step: string; ok: boolean; ms: number; error?: string }>;
}

const runsFile = () => path.join(config.stateDir, "runs.jsonl");
const created = () => path.join(config.stateDir, "created.json");

let runs: Map<string, RunRecord> | undefined;

function load(): Map<string, RunRecord> {
  if (runs) return runs;
  runs = new Map();
  try {
    for (const line of fs.readFileSync(runsFile(), "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line) as RunRecord;
        runs.set(r.run_id, r);
      } catch {
        /* skip corrupt line */
      }
    }
  } catch {
    /* no file yet */
  }
  return runs;
}

export function saveRun(r: RunRecord): RunRecord {
  r.updated_at = new Date().toISOString();
  load().set(r.run_id, r);
  fs.mkdirSync(config.stateDir, { recursive: true });
  fs.appendFileSync(runsFile(), JSON.stringify(r) + "\n");
  return r;
}

export function getRun(id: string): RunRecord | undefined {
  return load().get(id);
}

export function listRuns(): RunRecord[] {
  return [...load().values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function findByKey(key: string, maxAgeMs?: number): RunRecord | undefined {
  const now = Date.now();
  return listRuns().find((r) => r.idempotency_key === key && (maxAgeMs === undefined || now - Date.parse(r.created_at) < maxAgeMs));
}

export function newRunId(): string {
  return "r" + crypto.randomBytes(3).toString("hex");
}

export function pushStatus(r: RunRecord, status: string) {
  if (r.status !== status) r.status_history.push({ at: new Date().toISOString(), status });
  r.status = status;
}

/* ---- Resources the MCP created (for "only on MCP-created" gates) ---- */
interface Created { workspaces: string[]; panes: string[] }
function loadCreated(): Created {
  try {
    return JSON.parse(fs.readFileSync(created(), "utf8")) as Created;
  } catch {
    return { workspaces: [], panes: [] };
  }
}
export function markCreated(kind: "workspaces" | "panes", id: string) {
  const c = loadCreated();
  if (!c[kind].includes(id)) c[kind].push(id);
  fs.mkdirSync(config.stateDir, { recursive: true });
  fs.writeFileSync(created(), JSON.stringify(c));
}
export function isCreated(kind: "workspaces" | "panes", id: string): boolean {
  return loadCreated()[kind].includes(id);
}

/* ---- One-time approval tokens (in memory; a restart invalidates pending previews) ---- */
const tokens = new Map<string, { tool: string; argsHash: string; expires: number }>();

export function issueToken(tool: string, args: unknown): string {
  const t = "apv_" + crypto.randomBytes(8).toString("hex");
  tokens.set(t, { tool, argsHash: hash(args), expires: Date.now() + config.approvalTtlMs });
  return t;
}

/** Consumes the token if valid for this exact tool + args. */
export function consumeToken(tool: string, args: unknown, token: string | undefined): boolean {
  if (!token) return false;
  const rec = tokens.get(token);
  if (!rec) return false;
  tokens.delete(token);
  return rec.tool === tool && rec.argsHash === hash(args) && rec.expires > Date.now();
}
