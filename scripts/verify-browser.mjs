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
await page.addInitScript(() => {
  localStorage.setItem("@paseo:app-settings", JSON.stringify({ language: "zh-CN" }));
});
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
  await page.getByRole("button", { name: "Thinking", exact: true }).waitFor();
  await page.waitForTimeout(100);
  assert.equal(counts.size, 0, "collapsed thinking must not request translations");
  assert.equal(await markdown.count(), 0);
  await page.getByRole("button", { name: "Thinking", exact: true }).click();
  await page.getByText("正在翻译为简体中文…").waitFor();
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
  await page.getByRole("button", { name: "显示简体中文", exact: true }).click();
  await page.evaluate(() =>
    window.harness.update({ text: "First **bold**.\n\nTail **still growing" }),
  );
  await visible("Tail **still growing");
  assert.equal(counts.get("First"), 1);
  await page.evaluate(() => window.harness.update({ phase: "complete" }));
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
  await page.getByText("正在翻译为简体中文…").waitFor({ state: "detached" });
  assert.doesNotMatch(await markdown.innerText(), /Old/);

  const rich =
    "# Heading\n\n**bold *nested*** and ~~gone~~.\n\n1. first\n   - nested item\n\n> quoted\n\n| Name | Value |\n| --- | --- |\n| One | Two |\n\n[Docs](https://example.com)\n\n\\*literal\\* and `a ** b`\n\n```js\nconst x = '**code**';\n```";
  await page.evaluate((text) => window.harness.update({ text, phase: "complete" }), rich);
  await page.getByText("正在翻译为简体中文…").waitFor({ state: "detached" });
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
  await page.evaluate(() => window.harness.update({ text: "Collapsed only", phase: "complete" }));
  await page.waitForTimeout(100);
  assert.equal(counts.has("Collapsed only"), false);
  await page.getByRole("button", { name: "Thinking", exact: true }).click();
  await markdown.waitFor();
  await visible("译文:Collapsed only");
  await page.evaluate(() => window.harness.settings({ enabled: false }));
  await page.getByText("自动翻译已关闭").waitFor();
  await visible("Collapsed only");
  assert.doesNotMatch(await markdown.innerText(), /译文:/);
  await page.evaluate(() => window.harness.update({ screen: "settings", dark: false }));
  await page.getByTestId("settings-select-翻译服务").click();
  await page.getByRole("button", { name: "翻译服务: 微软翻译", exact: true }).click();
  await page.getByRole("textbox", { name: "微软 API Key", exact: true }).waitFor();
  await page.getByRole("textbox", { name: "微软区域", exact: true }).waitFor();
  await page.getByTestId("settings-select-翻译服务").click();
  await page.getByRole("button", { name: "翻译服务: Google Cloud", exact: true }).click();
  await page.getByTestId("settings-select-Google API 版本").click();
  await page
    .getByRole("button", { name: "Google API 版本: v3（OAuth Access Token）", exact: true })
    .click();
  await page.getByRole("textbox", { name: "OAuth Access Token", exact: true }).waitFor();
  await page.getByRole("textbox", { name: "Google Cloud 项目 ID", exact: true }).waitFor();
  await page.getByTestId("settings-select-翻译服务").click();
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
  const languageList = page.getByTestId("target-language-options");
  for (const viewport of [
    { width: 1100, height: 850 },
    { width: 375, height: 812 },
    { width: 375, height: 420 },
  ]) {
    for (const dark of [false, true]) {
      await page.setViewportSize(viewport);
      await page.evaluate(
        (dark) => window.harness.update({ dark, compact: window.innerWidth < 600 }),
        dark,
      );
      const settingsScroll = page.getByTestId("translation-settings");
      await settingsScroll.evaluate((element) => {
        element.scrollTop = 0;
      });
      const trigger = page.getByTestId("target-language-trigger");
      await trigger.scrollIntoViewIfNeeded();
      const row = page.getByTestId("target-language-row");
      const rowBefore = await row.boundingBox();
      const endpointBefore = await page
        .getByRole("textbox", { name: "Endpoint", exact: true })
        .boundingBox();
      const contentHeightBefore = await settingsScroll.evaluate((element) => element.scrollHeight);
      await trigger.click();
      await languageList.waitFor();
      assert.equal(await trigger.getAttribute("aria-expanded"), "true");
      await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "menuitem");
      assert.deepEqual(
        await row.boundingBox(),
        rowBefore,
        "opening a menu must not resize or move its row",
      );
      assert.deepEqual(
        await page.getByRole("textbox", { name: "Endpoint", exact: true }).boundingBox(),
        endpointBefore,
        "opening a menu must not push the following settings down",
      );
      assert.equal(
        await settingsScroll.evaluate((element) => element.scrollHeight),
        contentHeightBefore,
        "floating menu must not increase the settings page height",
      );
      assert.equal(
        (await trigger.boundingBox()).height,
        32,
        "trigger matches the host's compact control height",
      );
      const dimensions = await languageList.evaluate((element) => ({
        height: element.clientHeight,
        content: element.scrollHeight,
        overflow: getComputedStyle(element).overflowY,
        bounds: element.getBoundingClientRect().toJSON(),
      }));
      assert.ok(dimensions.height > 0);
      assert.ok(dimensions.height <= Math.min(320, viewport.height * 0.4));
      assert.ok(dimensions.content > dimensions.height, "language list must overflow internally");
      assert.equal(dimensions.overflow, "auto");
      assert.ok(dimensions.bounds.x >= 0 && dimensions.bounds.right <= viewport.width);
      assert.ok(
        dimensions.bounds.y >= 0 && dimensions.bounds.bottom <= viewport.height,
        `language list must fit viewport: ${JSON.stringify({ viewport, dimensions })}`,
      );
      const triggerBounds = await trigger.boundingBox();
      assert.ok(
        Math.abs(dimensions.bounds.right - (triggerBounds.x + triggerBounds.width)) <= 2,
        "floating menu must align to the right edge of its trigger",
      );
      if (viewport.height === 420) {
        assert.ok(
          dimensions.bounds.bottom < triggerBounds.y,
          "menu must open above its trigger when there is more room above",
        );
      } else {
        assert.ok(
          dimensions.bounds.y > triggerBounds.y + triggerBounds.height,
          "menu must open below its trigger when space permits",
        );
      }
      const last = languageList.getByRole("menuitem").last();
      assert.equal(await last.getAttribute("aria-label"), "目标语言: 其他语言…");
      const before = await last.boundingBox();
      assert.ok(before.y >= dimensions.bounds.bottom, "bottom option initially needs scrolling");
      await languageList.hover();
      await page.mouse.wheel(0, 10000);
      await page.waitForFunction(() => {
        const list = document.querySelector('[data-testid="target-language-options"]');
        return list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
      });
      const after = await last.boundingBox();
      const bounds = await languageList.boundingBox();
      assert.ok(after.y >= bounds.y && after.y + after.height <= bounds.y + bounds.height);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        true,
      );
      await page.screenshot({
        path: new URL(
          `.artifacts/languages-${viewport.width}x${viewport.height}-${dark ? "dark" : "light"}.png`,
          root,
        ).pathname,
      });
      if (viewport.height === 420 && dark) {
        await last.click();
        await languageList.waitFor({ state: "detached" });
        const input = page.getByRole("textbox", { name: "其他语言…", exact: true });
        await input.fill("sr-Latn");
        await page.getByRole("button", { name: "保存", exact: true }).click();
        await page.getByText("设置已保存").waitFor();
        assert.equal(settings.values.targetLanguage, "sr-Latn");
        const previousInput = await input.elementHandle();
        await page.getByRole("button", { name: "重新读取", exact: true }).click();
        await page.waitForFunction((element) => !element.isConnected, previousInput);
        assert.equal(await input.inputValue(), "sr-Latn");
      } else {
        const bottomLanguage = languageList.getByRole("menuitem").nth(-2);
        await bottomLanguage.click();
        await languageList.waitFor({ state: "detached" });
        await page.getByRole("button", { name: "保存", exact: true }).click();
        await page.getByText("设置已保存").waitFor();
        assert.equal(settings.values.targetLanguage, "vi");
        await page.getByRole("button", { name: "目标语言: 越南语", exact: true }).click();
        await languageList
          .getByRole("menuitem", { name: "目标语言: 简体中文", exact: true })
          .click();
      }
      await page.getByRole("button", { name: "重新读取", exact: true }).scrollIntoViewIfNeeded();
      if (viewport.height === 420) {
        assert.ok(
          await settingsScroll.evaluate((element) => element.scrollTop > 0),
          "settings page must still scroll independently",
        );
      }
    }
  }
  await page.setViewportSize({ width: 1100, height: 850 });
  await page.evaluate(() => window.harness.update({ dark: false, compact: false }));
  await page.getByRole("button", { name: "目标语言: 其他语言…", exact: true }).click();
  await languageList.getByRole("menuitem", { name: "目标语言: 法语", exact: true }).click();
  await languageList.waitFor({ state: "detached" });
  const frenchTrigger = page.getByTestId("target-language-trigger");
  assert.equal(await frenchTrigger.evaluate((element) => element === document.activeElement), true);
  await frenchTrigger.press("Enter");
  await languageList.waitFor();
  assert.equal(await frenchTrigger.getAttribute("aria-expanded"), "true");
  await languageList.getByRole("menuitem", { name: "目标语言: 法语", exact: true }).focus();
  await page.keyboard.press("Enter");
  await languageList.waitFor({ state: "detached" });
  await frenchTrigger.click();
  await languageList.waitFor();
  await page.keyboard.press("End");
  assert.equal(
    await languageList
      .getByRole("menuitem")
      .last()
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  assert.equal(
    await languageList
      .getByRole("menuitem")
      .nth(1)
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await page.keyboard.press("Escape");
  await languageList.waitFor({ state: "detached" });
  await frenchTrigger.click();
  await page.getByTestId("target-language-backdrop").click({ position: { x: 1, y: 1 } });
  await languageList.waitFor({ state: "detached" });
  await frenchTrigger.click();
  await languageList.waitFor();
  await page.setViewportSize({ width: 1000, height: 650 });
  await languageList.waitFor({ state: "detached" });
  let releaseSave;
  await page.route("**/settings", async (route) => {
    if (route.request().method() === "POST") {
      await new Promise((resolve) => (releaseSave = resolve));
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await waitFor(() => typeof releaseSave === "function");
  assert.equal(await frenchTrigger.getAttribute("aria-disabled"), "true");
  assert.equal(await frenchTrigger.getAttribute("aria-expanded"), "false");
  releaseSave();
  await page.getByText("设置已保存").waitFor();
  await page.unroute("**/settings");
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
  const english = await browser.newPage({ viewport: { width: 1100, height: 850 } });
  await english.addInitScript(() => {
    localStorage.setItem("@paseo:app-settings", JSON.stringify({ language: "en" }));
  });
  await english.goto(`http://127.0.0.1:${server.address().port}`);
  await english.getByRole("button", { name: "Show original", exact: true }).click();
  await english.getByRole("button", { name: /Show .*Chinese/ }).waitFor();
  await english.evaluate(() => window.harness.settings({ targetLanguage: "ja" }));
  await english.getByRole("button", { name: "Show Japanese", exact: true }).waitFor();
  await english.evaluate(() => window.harness.update({ screen: "settings" }));
  await english.getByText("Translation service", { exact: true }).waitFor();
  await english.getByText("Target language", { exact: true }).waitFor();
  await english.getByRole("button", { name: "Target language: Japanese", exact: true }).waitFor();
  await english
    .getByRole("button", { name: "Translation service: Google keyless endpoint", exact: true })
    .waitFor();
  await english.evaluate(() => {
    localStorage.setItem("@paseo:app-settings", JSON.stringify({ language: "ja" }));
  });
  await english.getByText("翻訳サービス", { exact: true }).waitFor();
  await english.close();
  console.log(
    "Browser integration passed: lazy translation, collapsed no-request, pending, streaming reuse, stale updates, retry, original toggle, collapse, Markdown, light/dark, 375px layout, floating language menu without layout shifts, above/below placement, wheel scrolling and bottom selection, keyboard navigation, Escape/outside dismissal, resize dismissal, custom-language persistence, settings validation/save/conflict/reload and Paseo-language following",
  );
} finally {
  translator.dispose();
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
