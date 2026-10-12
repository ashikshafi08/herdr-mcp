import os from "node:os";
import path from "node:path";
import { which } from "./runners.js";
import { err } from "./util.js";
export const ALL_KINDS = [
    "pi", "claude", "codex", "gemini", "cursor", "devin", "agy", "cline", "omp", "mastracode", "opencode",
    "copilot", "kimi", "kiro", "droid", "amp", "grok", "hermes", "kilo", "qodercli", "qwen", "maki", "muse",
];
/** Binaries that indicate a kind is installed. */
const BINARIES = {
    cursor: ["cursor-agent", "agent"],
    agy: ["antigravity-cli", "agy"],
    kiro: ["kiro-cli", "kiro"],
};
/** Extra dirs MCP clients often omit from PATH. */
export function augmentPath() {
    const h = os.homedir();
    const extra = [path.join(h, ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin", path.join(h, ".bun/bin"), path.join(h, ".opencode/bin"), path.join(h, ".cargo/bin")];
    const cur = (process.env.PATH ?? "").split(":");
    process.env.PATH = [...cur, ...extra.filter((d) => !cur.includes(d))].join(":");
}
export async function detectKinds() {
    if (process.env.HERDR_MCP_AGENT_KINDS)
        return process.env.HERDR_MCP_AGENT_KINDS.split(",").map((s) => s.trim()).filter(Boolean);
    const found = [];
    await Promise.all(ALL_KINDS.map(async (k) => {
        for (const b of BINARIES[k] ?? [k])
            if (await which(b))
                return void found.push(k);
    }));
    return ALL_KINDS.filter((k) => found.includes(k));
}
/** Translate `model` into native CLI flags (placed after `--`). Verified from each CLI's --help (design doc §2.2). */
export function modelArgs(kind, model) {
    if (!model)
        return [];
    switch (kind) {
        case "claude":
        case "cursor":
        case "pi":
            return ["--model", model];
        case "codex":
        case "grok":
        case "kimi":
        case "hermes":
            return ["-m", model];
        case "omp":
            return [`--model=${model}`];
        case "amp":
            if (["deep", "rush", "smart"].includes(model))
                return ["-m", model];
            return err("model_unsupported", `amp has no model flag; only modes deep|rush|smart (got "${model}").`, "Pass model as one of deep|rush|smart, or omit it.");
        default:
            return err("model_unsupported", `Agent kind "${kind}" has no known model flag on this host.`, "Omit `model` and configure it in the agent's own config, or pass raw flags in agent_args.");
    }
}
export const AGENT_NAME_RE = /^[a-z][a-z0-9_-]{0,31}$/;
export function nameFromBranch(branch) {
    let n = branch.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^[^a-z]+/, "").slice(0, 32).replace(/-+$/, "");
    if (!n)
        n = "agent";
    return n;
}
/** Per-kind "run without approval prompts" flags, verified from each CLI's --help on this Mac (2026-10-12):
 * claude 2.1.295, codex-cli 0.162.1, cursor-agent, grok, kimi, hermes, omp, cline, opencode.
 * amp (settings-only: amp.dangerouslyAllowAll), droid and pi have no CLI flag. */
export const SKIP_PERMISSION_FLAGS = {
    claude: ["--dangerously-skip-permissions"],
    codex: ["--dangerously-bypass-approvals-and-sandbox"],
    cursor: ["--force"],
    grok: ["--always-approve"],
    kimi: ["--yolo"],
    hermes: ["--yolo"],
    omp: ["--auto-approve"],
    cline: ["--yolo"],
    opencode: ["--auto"],
};
/** Default model/effort per kind (user preference 2026-10-12); overridable by params. */
export const DEFAULT_MODEL = {
    claude: { model: process.env.HERDR_MCP_CLAUDE_MODEL ?? "claude-opus-5-5", effort: process.env.HERDR_MCP_CLAUDE_EFFORT ?? "medium" },
    codex: { model: process.env.HERDR_MCP_CODEX_MODEL ?? "gpt-6.1-sol", effort: process.env.HERDR_MCP_CODEX_EFFORT ?? "high" },
};
export function skipPermissionsDefault() {
    const v = (process.env.HERDR_MCP_SKIP_PERMISSIONS ?? "1").toLowerCase();
    return !["0", "false", "no", "off"].includes(v);
}
/** claude: --effort low|medium|high|xhigh|max; codex: -c model_reasoning_effort=<level>. */
export function effortArgs(kind, effort) {
    if (!effort)
        return [];
    if (kind === "claude")
        return ["--effort", effort];
    if (kind === "codex")
        return ["-c", `model_reasoning_effort=${effort}`];
    return err("effort_unsupported", `Agent kind "${kind}" has no known reasoning-effort flag.`, "Omit effort, or pass raw flags in agent_args.");
}
/** Full `--` argv for agent start: skip-permission flag, model, effort, then caller extras. */
export function launchArgs(kind, o) {
    const d = DEFAULT_MODEL[kind];
    const skip = o.skipPermissions ?? skipPermissionsDefault();
    return [...(skip ? SKIP_PERMISSION_FLAGS[kind] ?? [] : []), ...modelArgs(kind, o.model ?? d?.model), ...effortArgs(kind, o.effort ?? d?.effort), ...(o.extra ?? [])];
}
//# sourceMappingURL=agents.js.map