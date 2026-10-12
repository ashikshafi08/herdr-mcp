// Spawns the built server over stdio and lists tools.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const c = new Client({ name: "list-test", version: "0" });
await c.connect(new StdioClientTransport({ command: process.execPath, args: [new URL("../dist/index.js", import.meta.url).pathname], stderr: "inherit" }));
const { tools } = await c.listTools();
for (const t of tools) {
  const props = Object.keys(t.inputSchema.properties ?? {});
  console.log(`${t.name.padEnd(22)} ro=${t.annotations?.readOnlyHint ?? false} destr=${t.annotations?.destructiveHint ?? "-"} req=[${(t.inputSchema.required ?? []).join(",")}] params=[${props.join(",")}]`);
}
const kind = tools.find((t) => t.name === "herdr_task").inputSchema.properties.agent_kind.enum;
console.log("agent_kind enum:", kind.join(","));
console.log("TOTAL", tools.length);
await c.close();
