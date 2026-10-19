import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const checkout = path.resolve(process.env.PASEO_CHECKOUT ?? path.join(root, "../paseo"));
const require = createRequire(path.join(checkout, "package.json"));
const { register } = await import(pathToFileURL(require.resolve("tsx/esm/api")).href);
register();
export const loadHost = (file) => import(pathToFileURL(path.join(checkout, file)).href);

export async function compile() {
  const { compilePlugin } = await loadHost("packages/server/src/server/plugins/compiler.ts");
  const bundle = await compilePlugin({
    client: path.join(root, "index.client.tsx"),
    server: path.join(root, "index.server.ts"),
  });
  assert.ok(bundle.clientBundle);
  assert.ok(bundle.serverBundle);
  await mkdir(path.join(root, ".artifacts"), { recursive: true });
  await writeFile(path.join(root, ".artifacts/client.cjs"), bundle.clientBundle);
  await writeFile(path.join(root, ".artifacts/server.cjs"), bundle.serverBundle);
  return bundle;
}
