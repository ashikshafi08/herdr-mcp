import { execFile } from "node:child_process";
import { config } from "./config.js";
export class ToolError extends Error {
    err;
    constructor(err) {
        super(err.message);
        this.err = err;
    }
}
let socketPath = process.env.HERDR_SOCKET_PATH;
export function setSocketPath(p) {
    socketPath = p;
}
export function getSocketPath() {
    return socketPath;
}
/** execFile with argv array: never a shell. */
export function runRaw(bin, args, opts = {}) {
    return new Promise((resolve) => {
        const env = { ...process.env };
        if (socketPath)
            env.HERDR_SOCKET_PATH = socketPath;
        // Never let `gh`/`git` open interactive prompts/pagers.
        env.GIT_TERMINAL_PROMPT = "0";
        env.GH_PROMPT_DISABLED = "1";
        env.GIT_PAGER = "cat";
        env.PAGER = "cat";
        execFile(bin, args, { cwd: opts.cwd, env, timeout: opts.timeoutMs ?? config.cliTimeoutMs, maxBuffer: 64 * 1024 * 1024, shell: false }, (error, stdout, stderr) => {
            let code = 0;
            if (error) {
                const e = error;
                if (e.code === "ENOENT") {
                    resolve({ stdout: "", stderr: `binary not found: ${bin}`, code: 127 });
                    return;
                }
                code = typeof e.code === "number" ? e.code : e.killed ? 124 : 1;
            }
            resolve({ stdout: String(stdout), stderr: String(stderr), code });
        });
    });
}
const HERDR_HINTS = {
    agent_not_found: "No agent matches that target. Call herdr_status view=agents and pass a listed name or pane_id.",
    agent_blocked: "The agent is waiting on an approval/question UI. Show it to the user (herdr_agent_read source=visible); answer only via herdr_agent_respond after the user decides.",
    agent_not_ready: "The agent has not finished starting (or is showing a startup prompt). Read it with herdr_agent_read source=visible and ask the user.",
    agent_prompt_stalled: "The prompt may already have been delivered. Do NOT resend; read output (herdr_agent_read) before retrying.",
    timeout: "Timed out. Do NOT blindly retry mutating calls; check state with herdr_status / herdr_agent_read first.",
    confirmation_required: "Herdr refused because this would close a worktree group. Use herdr_worktree_remove instead.",
    dirty_worktree_requires_force: "The checkout has modified or untracked files (live code, Herdr 0.9.0). Push/PR the work, or retry herdr_worktree_remove with force:true + force_confirm:true if the user accepts losing it.",
    agent_pane_busy: "The target pane is not an idle shell (still starting, or already running something). Wait a moment, or use another pane.",
    invalid_key: "Unsupported key name. Live-accepted: enter/Enter, esc/escape, ctrl+c, up, y (case-insensitive names).",
    pane_not_found: "Pane id not found. Call herdr_status view=panes.",
    workspace_not_found: "Workspace id not found. Call herdr_status view=summary.",
};
export function hintFor(code) {
    return HERDR_HINTS[code] ?? "Check the ids with herdr_status and retry with corrected arguments.";
}
function parseJson(s) {
    const t = s.trim();
    if (!t || (t[0] !== "{" && t[0] !== "["))
        return undefined;
    try {
        return JSON.parse(t);
    }
    catch {
        return undefined;
    }
}
/**
 * Run herdr. Returns `result` (socket-backed commands), the whole JSON (--json commands),
 * or `{text}` for text-output commands (e.g. agent read). Throws ToolError on failure.
 */
export async function herdr(args, opts = {}) {
    const r = await runRaw(config.herdrBin, args, opts);
    if (r.code !== 0) {
        const ej = parseJson(r.stderr);
        const code = ej?.error?.code ?? (r.code === 124 ? "cli_timeout" : r.code === 127 ? "herdr_missing" : r.code === 2 ? "usage_error" : "herdr_error");
        const message = ej?.error?.message ?? (r.stderr.trim() || r.stdout.trim() || `herdr exited ${r.code}`);
        throw new ToolError({
            code,
            message,
            hint: code === "herdr_missing" ? `Install herdr or set HERDR_BIN (looked at ${config.herdrBin}).` : code === "usage_error" ? "herdr rejected the argument syntax; this is a herdr-mcp bug, report argv." : hintFor(code),
            stderr: r.stderr.slice(0, 2000),
            exit_code: r.code,
            argv: ["herdr", ...args],
        });
    }
    const j = parseJson(r.stdout);
    if (j === undefined)
        return { text: r.stdout };
    if (j && typeof j === "object" && "result" in j)
        return j.result;
    return j;
}
export async function git(cwd, args, opts = {}) {
    const r = await runRaw(config.gitBin, ["-C", cwd, ...args], { timeoutMs: opts.timeoutMs });
    if (r.code !== 0 && !opts.allowFail) {
        throw new ToolError({
            code: "git_error",
            message: r.stderr.trim() || `git exited ${r.code}`,
            hint: "Check that the path is a git worktree and the ref/branch exists.",
            exit_code: r.code,
            argv: ["git", "-C", cwd, ...args],
        });
    }
    return r;
}
export async function gh(cwd, args, opts = {}) {
    const r = await runRaw(config.ghBin, args, { cwd, timeoutMs: opts.timeoutMs });
    if (r.code !== 0 && !opts.allowFail) {
        throw new ToolError({
            code: "gh_error",
            message: r.stderr.trim() || `gh exited ${r.code}`,
            hint: "Check `gh auth status` and that the branch was pushed and the base exists on the remote.",
            exit_code: r.code,
            argv: ["gh", ...args],
        });
    }
    return r;
}
export async function which(bin) {
    const r = await runRaw("/usr/bin/which", [bin], { timeoutMs: 5000 });
    return r.code === 0 && r.stdout.trim() !== "";
}
//# sourceMappingURL=runners.js.map