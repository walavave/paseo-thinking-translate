import assert from "node:assert/strict";
import { createServer } from "node:http";
import { compile, root, loadHost } from "./compile.mjs";

const { createTestPaseoDaemon } = await loadHost(
  "packages/server/src/server/test-utils/paseo-daemon.ts",
);
const { DaemonClient } = await loadHost("packages/server/src/server/test-utils/daemon-client.ts");

await compile();
console.log("Host compiler: client and server bundles passed import boundary checks");

let requests = 0;
const google = createServer((req, res) => {
  requests += 1;
  const q = new URL(req.url, "http://local").searchParams;
  assert.equal(q.get("sl"), "auto");
  if (q.get("q") === "fail") {
    res.writeHead(429).end();
    return;
  }
  res.end(JSON.stringify([[`译文:${q.get("q")}`, "en"]]));
});
await new Promise((resolve) => google.listen(0, "127.0.0.1", resolve));
const endpoint = `http://127.0.0.1:${google.address().port}/translate_a/t`;
let daemon;
let client;
try {
  daemon = await createTestPaseoDaemon({ mcpEnabled: false, pluginsEnabled: true });
  assert.notEqual(daemon.port, 6767);
  client = new DaemonClient({ url: `ws://127.0.0.1:${daemon.port}/ws` });
  await client.connect();
  const installed = await client.installDirectoryPlugin(root);
  assert.equal(installed.status, "running", JSON.stringify(installed));
  const rpc = (method, input) => client.invokePluginRpc("thinking-translate", method, input);
  const initial = await rpc("settings.thinking.read", {});
  assert.equal(initial.status, "ready");
  const saved = await rpc("settings.thinking.write", {
    revision: initial.revision,
    values: { ...initial.values, endpoint },
  });
  assert.equal(saved.status, "saved");
  const result = await rpc("thinking.translate", { texts: ["hello", "hello", "fail"] });
  assert.deepEqual(result, {
    results: [
      { status: "translated", text: "译文:hello", sourceLanguage: "en" },
      { status: "translated", text: "译文:hello", sourceLanguage: "en" },
      { status: "error", code: "rate_limit" },
    ],
  });
  assert.equal(requests, 2);
  assert.equal((await client.reloadPlugin("thinking-translate")).status, "running");
  const afterReload = await rpc("settings.thinking.read", {});
  assert.equal(afterReload.values.endpoint, endpoint);
  assert.deepEqual(await rpc("thinking.translate", { texts: ["hello"] }), {
    results: [{ status: "translated", text: "译文:hello", sourceLanguage: "en" }],
  });
  const off = await rpc("settings.thinking.write", {
    revision: afterReload.revision,
    values: { ...afterReload.values, enabled: false },
  });
  assert.equal(off.status, "saved");
  assert.deepEqual(await rpc("thinking.translate", { texts: ["not sent"] }), {
    results: [{ status: "error", code: "disabled" }],
  });
  const plugins = await client.listPlugins();
  assert.equal(plugins.find((plugin) => plugin.id === "thinking-translate")?.status, "running");
  console.log(
    `Isolated daemon on ${daemon.port}: install, settings, RPC, dedupe, partial failure, reload and disable passed`,
  );
} finally {
  if (client) await client.close();
  if (daemon) await daemon.close();
  google.closeAllConnections();
  await new Promise((resolve) => google.close(resolve));
}
