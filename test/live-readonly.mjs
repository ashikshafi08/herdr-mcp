// READ-ONLY live calls through the real MCP stdio server. No mutating tools are called,
// except gate *previews* that return before any action (they only mint a token).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const c = new Client({ name: "live-test", version: "0" });
await c.connect(new StdioClientTransport({ command: process.execPath, args: [new URL("../dist/index.js", import.meta.url).pathname], stderr: "inherit" }));
const call = async (name, args) => {
  const r = await c.callTool({ name, arguments: args });
  const sc = r.structuredContent;
  console.log(`\n=== ${name} ${JSON.stringify(args)} isError=${!!r.isError}`);
  console.log(r.content[0].text.split("\n")[0]);
  return sc;
};
const s = await call("herdr_status", { view: "summary" });
console.log("structured keys:", Object.keys(s), "agents:", s.agents?.length, "worktrees:", s.worktrees?.length);
await call("herdr_status", { view: "agents" });
await call("herdr_status", { view: "panes" });
const repo = process.env.TEST_REPO;
if (repo) {
  const w = await call("herdr_status", { view: "worktrees", repo_path: repo });
  console.log("checkouts:", w.worktrees?.length);
}
await call("herdr_status", { view: "run" });
const target = process.env.TEST_AGENT;
if (target) {
  const r = await call("herdr_agent_read", { agent: target, lines: 20, max_chars: 600 });
  console.log("read status:", r.status, "truncated:", r.truncated, "chars:", r.text?.length);
  const w = await call("herdr_run_wait", { agent: target, wait_ms: 2000, tail_lines: 5 });
  console.log("wait:", w.status, "changed:", w.changed, "timed_out:", w.timed_out, "needs_user:", w.needs_user);
}
const ws = process.env.TEST_WORKSPACE;
if (ws) {
  const d = await call("herdr_diff", { workspace_id: ws, mode: "stat" });
  console.log("diff:", JSON.stringify({ branch: d.branch, base: d.base, totals: d.totals, uncommitted: d.uncommitted_count, unpushed: d.unpushed_commits, patch_path: d.patch_path }));
  // Gate preview only (no action): worktree_remove refuses non-MCP-created without user_named.
  await call("herdr_worktree_remove", { workspace_id: ws });
}
// Error path: unknown agent -> structured error with hint
const e = await call("herdr_agent_read", { agent: "does-not-exist-xyz" });
console.log("error obj:", JSON.stringify(e.error));
// Path allowlist
await call("herdr_diff", { worktree_path: "/etc" });
await c.close();
