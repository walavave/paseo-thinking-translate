import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { build } from "esbuild";
import { chromium } from "playwright";
import { compile } from "./compile.mjs";

const root = new URL("../", import.meta.url);
await compile();
await mkdir(new URL(".artifacts/", root), { recursive: true });
await build({
  entryPoints: [new URL("tests/browser.jsx", root).pathname],
  outfile: new URL(".artifacts/browser.js", root).pathname,
  bundle: true,
  format: "esm",
  platform: "browser",
  define: { "process.env.NODE_ENV": '"development"' },
});
await build({
  entryPoints: [new URL("server/service.ts", root).pathname],
  outfile: new URL(".artifacts/browser-service.mjs", root).pathname,
  bundle: true,
  format: "esm",
  platform: "node",
});
const { TranslationService } = await import("../.artifacts/browser-service.mjs");
const translator = new TranslationService();
const counts = new Map();
const held = new Map();
let holdFirst = true;
let endpoint;
let settings = { status: "ready", revision: "initial", values: null };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://local");
    if (url.pathname === "/settings") {
      res.setHeader("Content-Type", "application/json");
      if (req.method === "POST") {
        let body = "";
        for await (const chunk of req) body += chunk;
        const input = JSON.parse(body);
        if (input.values.endpoint.endsWith("/reject") || input.revision !== settings.revision) {
          res.writeHead(409).end(JSON.stringify({ error: "设置冲突，请重新读取" }));
          return;
        }
        settings = { status: "ready", revision: "saved", values: input.values };
      }
      res.end(JSON.stringify(settings));
      return;
    }
    if (url.pathname === "/google") {
      const source = url.searchParams.get("q");
      counts.set(source, (counts.get(source) ?? 0) + 1);
      const send = () => {
        if (source === "Broken" && counts.get(source) === 1) {
          res.writeHead(429).end();
          return;
        }
        res.end(JSON.stringify([[`译文:${source}`, "en"]]));
      };
      if (holdFirst || source === "Old") held.set(source, send);
      else send();
      return;
    }
    if (url.pathname === "/rpc") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const { texts } = JSON.parse(body);
      const results = await Promise.all(
        texts.map((text) =>
          translator.translate({ provider: "google-free", endpoint, language: "zh-CN" }, text),
        ),
      );
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ results }));
      return;
    }
    if (url.pathname === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="/browser.js"></script></body></html>',
      );
      return;
    }
    const files = { "/browser.js": "browser.js", "/plugin.cjs": "client.cjs" };
    if (url.pathname in files) {
      res.setHeader("Content-Type", "application/javascript");
      res.end(await readFile(new URL(`.artifacts/${files[url.pathname]}`, root)));
    } else res.writeHead(404).end();
  } catch (error) {
    console.error(error);
    res.writeHead(500).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
endpoint = `http://127.0.0.1:${server.address().port}/google`;
settings.values = {
  enabled: true,
  provider: "google-free",
  targetLanguage: "zh-CN",
  endpoint,
  googleVersion: "v2",
  googleEndpoint: `http://127.0.0.1:${server.address().port}/google-cloud`,
  googleApiKey: "",
  googleAccessToken: "",
  googleProjectId: "",
  microsoftEndpoint: `http://127.0.0.1:${server.address().port}/microsoft`,
  microsoftApiKey: "",
  microsoftRegion: "",
};
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
async function waitFor(condition) {
  const deadline = Date.now() + 5000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for local HTTP request");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
const markdown = page.getByTestId("thinking-markdown");
async function visible(text) {
  await markdown.getByText(text, { exact: false }).first().waitFor();
}
try {
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByText("翻译中…").waitFor();
  await visible("First");
  await waitFor(() => held.size === 2);
  holdFirst = false;
  held.forEach((send) => send());
  held.clear();
  await visible("译文:First");
  assert.match(await markdown.innerText(), /Tail \*\*still/);
  assert.equal(counts.get("Tail **still"), undefined);
  assert.equal(
    await markdown
      .getByText("译文:bold", { exact: true })
      .evaluate((element) => getComputedStyle(element).fontWeight),
    "700",
  );
  await page.getByRole("button", { name: "显示原文", exact: true }).click();
  await visible("First");
  assert.doesNotMatch(await markdown.innerText(), /译文:/);
  assert.doesNotMatch(await markdown.innerText(), /\*\*bold\*\*/);
  await page.getByRole("button", { name: "显示中文", exact: true }).click();
  await page.evaluate(() =>
    window.harness.update({ text: "First **bold**.\n\nTail **still growing" }),
  );
  await visible("Tail **still growing");
  assert.equal(counts.get("First"), 1);
  await page.evaluate(() => window.harness.update({ phase: "complete" }));
  await markdown.waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Thinking", exact: true }).click();
  await visible("译文:Tail **still growing");
  await page.evaluate(() => window.harness.update({ text: "Broken\n\nFine", phase: "streaming" }));
  await page.getByRole("button", { name: "重试翻译", exact: true }).waitFor();
  await visible("Broken");
  await page.getByRole("button", { name: "重试翻译", exact: true }).click();
  await visible("译文:Broken");
  assert.equal(counts.get("Broken"), 2);
  await page.evaluate(() => window.harness.update({ text: "Old\n\nTail", phase: "streaming" }));
  await waitFor(() => held.has("Old"));
  await page.evaluate(() => window.harness.update({ text: "New\n\nTail", phase: "streaming" }));
  await visible("译文:New");
  held.get("Old")();
  held.clear();
  await page.getByText("翻译中…").waitFor({ state: "detached" });
  assert.doesNotMatch(await markdown.innerText(), /Old/);

  const rich =
    "# Heading\n\n**bold *nested*** and ~~gone~~.\n\n1. first\n   - nested item\n\n> quoted\n\n| Name | Value |\n| --- | --- |\n| One | Two |\n\n[Docs](https://example.com)\n\n\\*literal\\* and `a ** b`\n\n```js\nconst x = '**code**';\n```";
  await page.evaluate((text) => window.harness.update({ text, phase: "complete" }), rich);
  await page.getByText("翻译中…").waitFor({ state: "detached" });
  await visible("译文:Heading");
  assert.match(await markdown.innerText(), /a \*\* b/);
  assert.match(await markdown.innerText(), /const x = '\*\*code\*\*';/);
  assert.doesNotMatch(await markdown.innerText(), /\*\*bold|\*nested\*|~~gone~~|```/);
  assert.match(await markdown.innerText(), /\*译文:literal\*/);
  await markdown.getByRole("link", { name: "https://example.com", exact: true }).waitFor();
  await markdown.getByLabel("表格", { exact: true }).waitFor();
  await page.screenshot({
    path: new URL(".artifacts/wide-light.png", root).pathname,
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => window.harness.update({ dark: true, compact: true }));
  assert.equal(
    await markdown
      .getByText("译文:Heading", { exact: true })
      .evaluate((element) => getComputedStyle(element).color),
    "rgb(233, 235, 239)",
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  );
  await page.screenshot({
    path: new URL(".artifacts/compact-dark.png", root).pathname,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Thinking", exact: true }).click();
  await markdown.waitFor({ state: "detached" });
  await page.evaluate(() => window.harness.update({ phase: "streaming" }));
  await markdown.waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Thinking", exact: true }).click();
  await markdown.waitFor();
  await page.evaluate(() => window.harness.settings({ enabled: false }));
  await page.getByText("自动翻译已关闭").waitFor();
  await visible("Heading");
  assert.doesNotMatch(await markdown.innerText(), /译文:/);
  await page.evaluate(() => window.harness.update({ screen: "settings", dark: false }));
  await page.getByRole("button", { name: "翻译服务: 微软翻译", exact: true }).click();
  await page.getByRole("textbox", { name: "微软 API Key", exact: true }).waitFor();
  await page.getByRole("textbox", { name: "微软区域", exact: true }).waitFor();
  await page.getByRole("button", { name: "翻译服务: Google Cloud", exact: true }).click();
  await page
    .getByRole("button", { name: "Google API 版本: v3（OAuth Access Token）", exact: true })
    .click();
  await page.getByRole("textbox", { name: "OAuth Access Token", exact: true }).waitFor();
  await page.getByRole("textbox", { name: "Google Cloud 项目 ID", exact: true }).waitFor();
  await page.getByRole("button", { name: "翻译服务: Google 免费接口", exact: true }).click();
  await page.getByRole("textbox", { name: "Endpoint", exact: true }).waitFor();
  await page.getByRole("textbox", { name: "Endpoint", exact: true }).fill("invalid");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByText("请填写有效的目标语言和 HTTP(S) endpoint。").waitFor();
  await page.getByRole("button", { name: "重新读取", exact: true }).click();
  await page.waitForFunction(
    (value) => document.querySelector('[aria-label="Endpoint"]')?.value === value,
    endpoint,
  );
  await page.getByRole("textbox", { name: "目标语言", exact: true }).fill("fr");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByText("设置已保存").waitFor();
  assert.equal(settings.values.targetLanguage, "fr");
  await page.getByRole("textbox", { name: "Endpoint", exact: true }).fill(endpoint + "/reject");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByText("设置冲突，请重新读取").waitFor();
  await page.getByRole("button", { name: "重新读取", exact: true }).click();
  await page.waitForFunction(
    (value) => document.querySelector('[aria-label="Endpoint"]')?.value === value,
    endpoint,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser integration passed: pending, streaming reuse, stale updates, retry, original toggle, collapse, Markdown, light/dark, 375px layout and settings validation/save/conflict/reload",
  );
} finally {
  translator.dispose();
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
