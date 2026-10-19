import { createServer, type Server, type RequestListener } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { TranslationService, parseTranslation } from "./service";

const servers: Server[] = [];
const services: TranslationService[] = [];
afterEach(async () => {
  services.splice(0).forEach((service) => service.dispose());
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

async function endpoint(handler: RequestListener) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing port");
  return `http://127.0.0.1:${address.port}/translate_a/t`;
}
function service(options: ConstructorParameters<typeof TranslationService>[0] = {}) {
  const instance = new TranslationService(options);
  services.push(instance);
  return instance;
}

describe("Google translation", () => {
  it("parses both Google response shapes and rejects incomplete results", () => {
    expect(parseTranslation([["中文", "en"]])).toEqual({ text: "中文", sourceLanguage: "en" });
    expect(
      parseTranslation([
        [
          ["一", "en"],
          ["二", "en"],
        ],
      ]),
    ).toEqual({ text: "一二", sourceLanguage: "en" });
    expect(() => parseTranslation([[["一", "en"], [null]]])).toThrow(
      "Invalid translation response",
    );
    expect(() => parseTranslation([["", "en"]])).toThrow("Invalid translation response");
  });
  it("sends the configured language and caches and coalesces identical requests", async () => {
    let requests = 0;
    const url = await endpoint((req, res) => {
      const query = new URL(req.url!, "http://local").searchParams;
      expect(query.get("q")).toBe("hello");
      expect(query.get("tl")).toBe("zh-CN");
      expect(query.get("sl")).toBe("auto");
      requests += 1;
      res.end(JSON.stringify([["你好", "en"]]));
    });
    const api = service();
    const results = await Promise.all([
      api.translate(url, "zh-CN", "hello"),
      api.translate(url, "zh-CN", "hello"),
    ]);
    expect(results).toEqual([
      { status: "translated", text: "你好", sourceLanguage: "en" },
      { status: "translated", text: "你好", sourceLanguage: "en" },
    ]);
    expect(await api.translate(url, "zh-CN", "hello")).toEqual(results[0]);
    expect(requests).toBe(1);
  });
  it("does not reverse Chinese and separates cached languages", async () => {
    let requests = 0;
    const url = await endpoint((_req, res) => {
      requests += 1;
      res.end('[["原文","zh-CN"]]');
    });
    const api = service();
    expect(await api.translate(url, "zh-CN", "原文")).toEqual({
      status: "translated",
      text: "原文",
      sourceLanguage: "zh-CN",
    });
    await api.translate(url, "fr", "原文");
    expect(requests).toBe(2);
  });
  it("limits concurrency and bounds the cache", async () => {
    let active = 0;
    let peak = 0;
    let requests = 0;
    const url = await endpoint((_req, res) => {
      requests += 1;
      active += 1;
      peak = Math.max(peak, active);
      setTimeout(() => {
        active -= 1;
        res.end('[["译文","en"]]');
      }, 10);
    });
    const api = service({ maxEntries: 2 });
    await Promise.all(
      ["one", "two", "three", "four"].map((text) => api.translate(url, "zh-CN", text)),
    );
    expect(peak).toBe(2);
    await api.translate(url, "zh-CN", "one");
    expect(requests).toBe(5);
  });
  it("returns partial failures and allows a failed request to be retried", async () => {
    let attempts = 0;
    const url = await endpoint((req, res) => {
      const text = new URL(req.url!, "http://local").searchParams.get("q");
      if (text === "bad" && attempts++ === 0) {
        res.writeHead(429).end();
        return;
      }
      res.end('[["成功","en"]]');
    });
    const api = service();
    expect(
      await Promise.all(["good", "bad"].map((text) => api.translate(url, "zh-CN", text))),
    ).toEqual([
      { status: "translated", text: "成功", sourceLanguage: "en" },
      { status: "error", code: "rate_limit" },
    ]);
    expect(await api.translate(url, "zh-CN", "bad")).toEqual({
      status: "translated",
      text: "成功",
      sourceLanguage: "en",
    });
  });
  it("times out while reading the response body", async () => {
    const url = await endpoint((_req, res) => {
      res.writeHead(200);
      res.write("[");
    });
    expect(await service({ timeoutMs: 30 }).translate(url, "zh-CN", "hello")).toEqual({
      status: "error",
      code: "timeout",
    });
  });
  it("reports invalid JSON and HTTP failures", async () => {
    const url = await endpoint((req, res) => {
      if (req.url!.includes("forbidden")) {
        res.writeHead(403).end();
        return;
      }
      res.end("not json");
    });
    const api = service();
    expect(await api.translate(url, "zh-CN", "hello")).toEqual({
      status: "error",
      code: "invalid_response",
    });
    expect(await api.translate(url, "zh-CN", "forbidden")).toEqual({
      status: "error",
      code: "http",
    });
  });
  it("disposes active and queued work without starting more requests", async () => {
    const url = await endpoint((_req, res) => {
      res.writeHead(200);
      res.write("[");
    });
    const api = service();
    const pending = ["a", "b", "c"].map((text) => api.translate(url, "zh-CN", text));
    api.dispose();
    expect(await Promise.all(pending)).toEqual(
      Array.from({ length: 3 }, () => ({ status: "error", code: "disposed" })),
    );
    expect(await api.translate(url, "zh-CN", "d")).toEqual({ status: "error", code: "disposed" });
  });
});
