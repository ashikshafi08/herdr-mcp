import os from "node:os";
import path from "node:path";

const home = os.homedir();
const expand = (p: string) => (p.startsWith("~") ? path.join(home, p.slice(1)) : p);
const list = (v: string | undefined, def: string[]) =>
  v === undefined || v.trim() === "" ? def : v.split(/[:,]/).map((s) => s.trim()).filter(Boolean);

export const config = {
  herdrBin: expand(process.env.HERDR_BIN ?? "~/.local/bin/herdr"),
  gitBin: process.env.HERDR_MCP_GIT_BIN ?? "git",
  ghBin: process.env.HERDR_MCP_GH_BIN ?? "gh",
  /** Repo paths / worktree paths must live under one of these roots. */
  allowedRoots: list(process.env.HERDR_MCP_ALLOWED_ROOTS, ["~"]).map(expand).map((p) => path.resolve(p)),
  /** herdr_pane_run commands that run without the approval gate (exact match or prefix + space). */
  paneRunAllowlist: list(process.env.HERDR_MCP_PANE_ALLOWLIST, [
    "just test", "cargo test", "npm test", "pnpm test", "bun test", "go test ./...", "pytest", "make test",
  ]),
  /** Protocol the server was built against; mismatch => refuse (override HERDR_MCP_EXPECT_PROTOCOL=any). */
  expectProtocol: process.env.HERDR_MCP_EXPECT_PROTOCOL ?? "22",
  stateDir: expand(process.env.HERDR_MCP_STATE_DIR ?? "~/.local/state/herdr-mcp"),
  tmpDir: expand(process.env.HERDR_MCP_TMP_DIR ?? path.join(os.tmpdir(), "herdr-mcp")),
  approvalTtlMs: Number(process.env.HERDR_MCP_APPROVAL_TTL_MS ?? 10 * 60_000),
  cliTimeoutMs: Number(process.env.HERDR_MCP_CLI_TIMEOUT_MS ?? 60_000),
};

export function isUnderAllowedRoot(p: string): boolean {
  const abs = path.resolve(expand(p));
  return config.allowedRoots.some((r) => abs === r || abs.startsWith(r + path.sep));
}
