# herdr-mcp

MCP server (stdio, TypeScript, `@modelcontextprotocol/sdk`) that lets an MCP client drive
[Herdr](https://herdr.dev) coding-agent workspaces: create worktrees, start/prompt agents, wait on them,
read output, diff, open PRs, and clean up. It shells out to `herdr`, `git` and `gh` with argv arrays
(no shell), following `herdr-mcp-tool-design-2026-10-12.md` (v1, 13 tools).

Must run **on the same host as the Herdr server**, since the socket is Unix-only.

## Build / run

```sh
pnpm install
pnpm build            # tsc -> dist/
node dist/index.js    # stdio MCP server (logs go to stderr)
```

Tests (read-only):

```sh
pnpm test:list                                   # tools/list over stdio
TEST_REPO=/path/to/repo TEST_AGENT=w8:p1 TEST_WORKSPACE=w8 pnpm test:live
node test/gate-preview.mjs                       # approval gate preview only (runs nothing)
```

## MCP client config

Claude Code / Claude Desktop / Cursor style:

```json
{
  "mcpServers": {
    "herdr": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/herdr-mcp/dist/index.js"],
      "env": {
        "HERDR_MCP_ALLOWED_ROOTS": "/path/to/your/repos",
        "HERDR_MCP_PANE_ALLOWLIST": "just test,cargo test,pnpm test"
      }
    }
  }
}
```

Claude Code CLI: `claude mcp add herdr -- node /ABSOLUTE/PATH/TO/herdr-mcp/dist/index.js`

## Environment

| Var | Default | Meaning |
|---|---|---|
| `HERDR_BIN` | `~/.local/bin/herdr` | herdr binary |
| `HERDR_SOCKET_PATH` | from `herdr session list --json` | pin the Herdr socket |
| `HERDR_MCP_SESSION` | default session | session name to resolve the socket from |
| `HERDR_MCP_ALLOWED_ROOTS` | `~/repos` (set to your own) | repo/worktree paths must be under these (`:` or `,` separated) |
| `HERDR_MCP_PANE_ALLOWLIST` | `just test,cargo test,npm test,pnpm test,bun test,go test ./...,pytest,make test` | `herdr_pane_run` commands that skip the gate (exact or prefix+space, no shell metacharacters) |
| `HERDR_MCP_AGENT_KINDS` | auto-detected from PATH | override the `agent_kind` enum |
| `HERDR_MCP_EXPECT_PROTOCOL` | `22` | refuse to start on another protocol (`any` disables) |
| `HERDR_MCP_STATE_DIR` | `~/.local/state/herdr-mcp` | `runs.jsonl`, `created.json` |
| `HERDR_MCP_TMP_DIR` | `$TMPDIR/herdr-mcp` | full patches / full output files |
| `HERDR_MCP_APPROVAL_TTL_MS` | 600000 | approval token lifetime |
| `HERDR_MCP_GIT_BIN` / `HERDR_MCP_GH_BIN` | `git` / `gh` | |
| `HERDR_MCP_SKIP_PERMISSIONS` | `1` | start agents with their skip-sandbox/bypass-approvals flag by default (`0` disables) |
| `HERDR_MCP_MODEL_<KIND>` / `HERDR_MCP_EFFORT_<KIND>` | per-kind defaults | override default model/effort, e.g. `HERDR_MCP_MODEL_CLAUDE=claude-opus-5-5` |

## Tools

Read-only: `herdr_status`, `herdr_agent_read`, `herdr_run_wait`, `herdr_diff`.
Additive: `herdr_task`, `herdr_worktree_create`, `herdr_agent_start`, `herdr_agent_prompt`, `herdr_agent_stop` (interrupt/escape).
Gated (preview → `approval_token` → call again with `confirm:true` + token): `herdr_agent_respond` (always),
`herdr_pr_open` (always), `herdr_worktree_remove` (always; force needs `force_confirm`), `herdr_agent_stop mode=close_pane`,
`herdr_pane_run` off-allowlist, and any call with `trust_repository:true`.

Typical flow: `herdr_task` → loop `herdr_run_wait` → `herdr_diff` → `herdr_pr_open` → `herdr_worktree_remove`.

### Agent launch defaults

`herdr_agent_start` / `herdr_task` launch each agent with a skip-permissions flag so it runs without approval prompts (override per call with `skip_permissions:false`, or globally `HERDR_MCP_SKIP_PERMISSIONS=0`):

| Kind | Skip flag | Default model | Default effort |
|---|---|---|---|
| claude | `--dangerously-skip-permissions` | `claude-opus-5-5` | `medium` |
| codex | `--dangerously-bypass-approvals-and-sandbox` | `gpt-6.1-sol` | `high` |
| cursor | `--force` | – | – |
| grok | `--always-approve` | – | – |
| kimi / hermes / cline | `--yolo` | – | – |
| omp | `--auto-approve` | – | – |
| opencode | `--auto` | – | – |

Per-call params: `model`, `effort`, `skip_permissions`. Note: a new repo still shows a one-time "trust this folder?" dialog that the skip flags don't cover; it surfaces as `blocked` and is answered via `herdr_agent_respond` (or pre-trusted with `trust_repository:true`, which is approval-gated).
