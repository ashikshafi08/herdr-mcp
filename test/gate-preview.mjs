// Gate preview only: off-allowlist herdr_pane_run returns approval_required + token and runs NOTHING.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const c = new Client({ name: "gate-test", version: "0" });
await c.connect(new StdioClientTransport({ command: process.execPath, args: [new URL("../dist/index.js", import.meta.url).pathname] }));
const args = { workspace_id: "w8", command: "echo hi; ls" };
const r = await c.callTool({ name: "herdr_pane_run", arguments: args });
console.log("preview isError=", !!r.isError, "approval_required=", r.structuredContent.approval_required, "token=", r.structuredContent.approval_token?.slice(0, 8) + "...");
const r2 = await c.callTool({ name: "herdr_pane_run", arguments: { ...args, confirm: true, approval_token: "apv_bogus" } });
console.log("bogus token -> approval_required=", r2.structuredContent.approval_required);
await c.close();
