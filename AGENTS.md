# AGENTS.md

Guidance for AI coding agents working on **herdr-mcp** — an MCP server that drives the Herdr coding-agent orchestrator (worktrees, panes, agents) from a chat client.

## What this is
A stdio MCP server (TypeScript, `@modelcontextprotocol/sdk`, zod) wrapping the `herdr` CLI (v0.9.0, protocol 22). CLI-first: every Herdr call goes through `herdr(args[])` (execFile, `shell:false`); git/gh have their own runners. Phase 2 (socket NDJSON streaming, progress notifications, Tasks extension) is not built yet.

## Build / run / test
- `pnpm install && pnpm build` → `dist/index.js`
- Run: `node dist/index.js` (stdio)
- `pnpm test:list` — tools/list sanity
- `TEST_REPO=… TEST_AGENT=w8:p1 TEST_WORKSPACE=w8 pnpm test:live` — read-only live calls
- `node test/live-driver.mjs` + `test/q.sh '<json>'` — one persistent server process (approval tokens survive across calls)
- Live mutating tests MUST use a throwaway repo under an allowed root, and clean up every worktree/pane/workspace + agent folder-trust entries afterward. Never touch real projects or the pre-existing workspaces.

## Layout
`src/index.ts` (server + startup preflight), `src/tools.ts` (handlers + `gate()` approval), `src/runners.ts` (`herdr`/`git`/`gh`), `src/herdrApi.ts`, `src/agents.ts` (per-kind launch flags), `src/config.ts`, `src/store.ts` (runs.jsonl, created.json), `src/util.ts`.

## Hard rules (don't regress these)
- **Never run a shell string.** execFile with arg arrays only; reject shell metacharacters in allowlisted pane commands.
- **Never auto-answer a permission/trust prompt.** Blocked state returns `needs_user` + `blocked_prompt` + a "show the user" hint; answering goes through `herdr_agent_respond`, which is approval-gated.
- **Approval gate:** gated tools return a preview + one-time token (bound to tool+args sha256, 10 min TTL) first; they only act when re-called with `confirm:true` + that token. Wrong/expired token → fresh preview, never execution. Gated: `herdr_agent_respond`, `herdr_pr_open`, `herdr_worktree_remove` (force needs `force_confirm`), `herdr_agent_stop mode=close_pane`, off-allowlist `herdr_pane_run`, any `trust_repository:true`.
- **Path confinement:** repo/worktree paths must sit under `HERDR_MCP_ALLOWED_ROOTS` (default `~`; set your own).
- **MCP-created tracking (`created.json`):** only close panes / remove worktrees the server created, unless `user_named:true`; refuse the primary checkout.
- **Output caps:** keep a tail/head with a truncation marker; write full output/patches to `$TMPDIR/herdr-mcp/` and return the path.
- **Waits:** use `agent wait --until … --timeout` (Herdr `timeout` → `changed:false`, not an error). Never use `agent prompt --wait` (can hang).

## Agent launch defaults (per user requirement)
`herdr_agent_start`/`herdr_task` build the `--` argv as: skip-approvals flag, model, effort, then `agent_args` (`launchArgs()` in `src/agents.ts`). Override per call with `skip_permissions:false` / `model` / `effort`, or env `HERDR_MCP_SKIP_PERMISSIONS=0`, `HERDR_MCP_{CLAUDE,CODEX}_{MODEL,EFFORT}`.

| kind | skip flag | default model | effort |
|---|---|---|---|
| claude | `--dangerously-skip-permissions` | `claude-opus-5-5` | `medium` |
| codex | `--dangerously-bypass-approvals-and-sandbox` | `gpt-6.1-sol` | `high` |
| cursor | `--force` | – | – |
| grok | `--always-approve` | – | – |
| kimi/hermes/cline | `--yolo` | – | – |
| omp | `--auto-approve` | – | – |
| opencode | `--auto` | – | – |
| amp/droid/pi | none | – | – |

Note: new repos still show a one-time per-folder **trust** dialog the skip flags don't cover; it surfaces as `blocked`/`needs_user` (Claude's default highlight is "No, exit", so don't blind-enter). Pre-trust via `trust_repository:true` (gated).

## Verified Herdr behaviors (0.9.0, protocol 22)
- `agent prompt` without `--wait` returns ~0.43s with status still `idle`; `working` follows.
- create → `{workspace{workspace_id}, tab, root_pane{pane_id}, worktree{path,branch}}`; open adds `already_open`, `checkout_path`.
- send-keys accepts `enter/Enter/esc/escape/ctrl+c/up/y`; unknown → `invalid_key`.
- dirty worktree remove without force → `dirty_worktree_requires_force`; agent wait timeout code = `timeout`.
- `pane close` on a worktree's last pane silently closes the whole workspace (no confirmation), so the server refuses it (`last_pane`).
- `done` is a real status (ready, like `idle`). Blocked detection is reliable for hook-integrated kinds (claude, codex, cursor, grok, pi, omp, droid, hermes); cross-check others with `agent explain --json`.
- Creating a worktree also opens a workspace for the source repo — watch for the side effect.

## Still unverified (need a live GitHub remote / uninstalled shells)
`herdr_pr_open` real push + `gh pr create`; kind=cursor argv; fish/nu pane marker; `--session` retargeting; `--trust-repository` semantics; blocked detection for opencode/kimi.
