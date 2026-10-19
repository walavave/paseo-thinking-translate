import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";

await mkdir(new URL("../.artifacts/", import.meta.url), { recursive: true });
await build({
  entryPoints: [new URL("../server/service.ts", import.meta.url).pathname],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: new URL("../.artifacts/service.mjs", import.meta.url).pathname,
});
const { TranslationService } = await import("../.artifacts/service.mjs");
const service = new TranslationService();
try {
  const result = await service.translate(
    "https://clients5.google.com/translate_a/t",
    "zh-CN",
    "I need to inspect the failing test before changing the code.",
  );
  assert.equal(result.status, "translated", JSON.stringify(result));
  assert.match(result.text, /\p{Script=Han}/u);
  const chinese = await service.translate(
    "https://clients5.google.com/translate_a/t",
    "zh-CN",
    "先检查测试，再修改代码。",
  );
  assert.equal(chinese.status, "translated", JSON.stringify(chinese));
  assert.match(chinese.text, /\p{Script=Han}/u);
  console.log("Google live response:", result.text);
  console.log("Chinese remains Chinese:", chinese.text);
} finally {
  service.dispose();
}
