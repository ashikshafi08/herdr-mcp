// Interactive live driver: one MCP server process; append JSON lines {name,arguments} to $Q/in,
// results are appended to $Q/out. "$TOKEN" in arguments = last approval_token returned.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs";
const Q = process.env.Q ?? "/tmp/hmcp"; fs.mkdirSync(Q, { recursive: true });
fs.writeFileSync(`${Q}/in`, ""); fs.writeFileSync(`${Q}/out`, "");
const c = new Client({ name: "live-driver", version: "0" });
await c.connect(new StdioClientTransport({ command: process.execPath, args: [new URL("../dist/index.js", import.meta.url).pathname], env: process.env, stderr: "inherit" }));
let token, pos = 0;
const sub = (v) => typeof v === "string" ? (v === "$TOKEN" ? token : v) : Array.isArray(v) ? v.map(sub) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sub(x)])) : v;
for (;;) {
  const all = fs.readFileSync(`${Q}/in`, "utf8"); const lines = all.slice(pos).split("\n"); 
  if (lines.length > 1) {
    pos += all.slice(pos).lastIndexOf("\n") + 1;
    for (const l of lines.slice(0, -1).filter(Boolean)) {
      const req = JSON.parse(l); if (req.name === "QUIT") { await c.close(); process.exit(0); }
      const t0 = Date.now(); let r;
      try { r = await c.callTool({ name: req.name, arguments: sub(req.arguments ?? {}) }, undefined, { timeout: 300000 }); } catch (e) { r = { exception: String(e) }; }
      if (r.structuredContent?.approval_token) token = r.structuredContent.approval_token;
      fs.appendFileSync(`${Q}/out`, JSON.stringify({ name: req.name, ms: Date.now() - t0, isError: !!r.isError, text: r.content?.[0]?.text, sc: r.structuredContent, exception: r.exception }) + "\n");
    }
  }
  await new Promise((s) => setTimeout(s, 200));
}
