import { createServer, type Server, type RequestListener, type IncomingMessage } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  TranslationService,
  microsoftLanguage,
  parseGoogleV2,
  parseGoogleV3,
  parseMicrosoft,
  parseTranslation,
  type TranslationConfig,
} from "./service";

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
  return `http://127.0.0.1:${address.port}`;
}
function service(options: ConstructorParameters<typeof TranslationService>[0] = {}) {
  const instance = new TranslationService(options);
  services.push(instance);
  return instance;
}
function free(endpoint: string, language = "zh-CN"): TranslationConfig {
  return { provider: "google-free", endpoint: `${endpoint}/translate_a/t`, language };
}
async function bodyOf(request: IncomingMessage): Promise<unknown> {
  let body = "";
  for await (const chunk of request) body += chunk;
  return JSON.parse(body);
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
      api.translate(free(url), "hello"),
      api.translate(free(url), "hello"),
    ]);
    expect(results).toEqual([
      { status: "translated", text: "你好", sourceLanguage: "en" },
      { status: "translated", text: "你好", sourceLanguage: "en" },
    ]);
    expect(await api.translate(free(url), "hello")).toEqual(results[0]);
    expect(requests).toBe(1);
  });
  it("does not reverse Chinese and separates cached languages", async () => {
    let requests = 0;
    const url = await endpoint((_req, res) => {
      requests += 1;
      res.end('[["原文","zh-CN"]]');
    });
    const api = service();
    expect(await api.translate(free(url), "原文")).toEqual({
      status: "translated",
      text: "原文",
      sourceLanguage: "zh-CN",
    });
    await api.translate(free(url, "fr"), "原文");
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
      ["one", "two", "three", "four"].map((text) => api.translate(free(url), text)),
    );
    expect(peak).toBe(2);
    await api.translate(free(url), "one");
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
      await Promise.all(["good", "bad"].map((text) => api.translate(free(url), text))),
    ).toEqual([
      { status: "translated", text: "成功", sourceLanguage: "en" },
      { status: "error", code: "rate_limit" },
    ]);
    expect(await api.translate(free(url), "bad")).toEqual({
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
    expect(await service({ timeoutMs: 30 }).translate(free(url), "hello")).toEqual({
      status: "error",
      code: "timeout",
    });
  });
  it("reports invalid JSON, HTTP and auth failures", async () => {
    const url = await endpoint((req, res) => {
      const query = new URL(req.url!, "http://local").searchParams;
      if (query.get("q") === "forbidden") {
        res.writeHead(403).end();
        return;
      }
      res.end("not json");
    });
    const api = service();
    expect(await api.translate(free(url), "hello")).toEqual({
      status: "error",
      code: "invalid_response",
    });
    expect(await api.translate(free(url), "forbidden")).toEqual({
      status: "error",
      code: "auth",
    });
  });
  it("disposes active and queued work without starting more requests", async () => {
    const url = await endpoint((_req, res) => {
      res.writeHead(200);
      res.write("[");
    });
    const api = service();
    const pending = ["a", "b", "c"].map((text) => api.translate(free(url), text));
    api.dispose();
    expect(await Promise.all(pending)).toEqual(
      Array.from({ length: 3 }, () => ({ status: "error", code: "disposed" })),
    );
    expect(await api.translate(free(url), "d")).toEqual({ status: "error", code: "disposed" });
  });
});

describe("Google Cloud Translation", () => {
  it("posts v2 requests with an API key and parses the response", async () => {
    let received: unknown;
    const url = await endpoint(async (req, res) => {
      expect(req.method).toBe("POST");
      expect(req.url).toBe("/language/translate/v2?key=secret");
      expect(req.headers["content-type"]).toBe("application/json");
      received = await bodyOf(req);
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          data: { translations: [{ translatedText: "你好", detectedSourceLanguage: "en" }] },
        }),
      );
    });
    expect(
      await service().translate(
        { provider: "google-v2", endpoint: url, apiKey: "secret", language: "zh-CN" },
        "hello",
      ),
    ).toEqual({ status: "translated", text: "你好", sourceLanguage: "en" });
    expect(received).toEqual({ q: "hello", target: "zh-CN", format: "text" });
  });
  it("posts v3 requests with a bearer token and project path", async () => {
    let received: unknown;
    const url = await endpoint(async (req, res) => {
      expect(req.method).toBe("POST");
      expect(req.url).toBe("/v3/projects/my-project/locations/global:translateText");
      expect(req.headers.authorization).toBe("Bearer token");
      received = await bodyOf(req);
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          translations: [{ translatedText: "你好", detectedLanguageCode: "en" }],
        }),
      );
    });
    expect(
      await service().translate(
        {
          provider: "google-v3",
          endpoint: url,
          accessToken: "token",
          projectId: "my-project",
          language: "zh-CN",
        },
        "hello",
      ),
    ).toEqual({ status: "translated", text: "你好", sourceLanguage: "en" });
    expect(received).toEqual({
      contents: ["hello"],
      targetLanguage: "zh-CN",
      mimeType: "text/plain",
    });
  });
  it("accepts endpoints that already end in a version path", async () => {
    const url = await endpoint((req, res) => {
      expect(req.url).toContain("/v3/projects/my-project");
      res.end(JSON.stringify({ translations: [{ translatedText: "好" }] }));
    });
    expect(
      await service().translate(
        {
          provider: "google-v3",
          endpoint: `${url}/v3`,
          accessToken: "token",
          projectId: "my-project",
          language: "zh-CN",
        },
        "hello",
      ),
    ).toEqual({ status: "translated", text: "好", sourceLanguage: null });
  });
  it("parses v2 and v3 shapes and rejects malformed responses", () => {
    expect(parseGoogleV2({ data: { translations: [{ translatedText: "一" }] } })).toEqual({
      text: "一",
      sourceLanguage: null,
    });
    expect(parseGoogleV3({ translations: [{ translatedText: "二" }] })).toEqual({
      text: "二",
      sourceLanguage: null,
    });
    expect(() => parseGoogleV2({})).toThrow("Invalid translation response");
    expect(() => parseGoogleV2({ data: { translations: [{}] } })).toThrow(
      "Invalid translation response",
    );
    expect(() => parseGoogleV3({ translations: [] })).toThrow("Invalid translation response");
  });
});

describe("Microsoft Translator", () => {
  it("posts v3 requests with key, region and mapped language", async () => {
    let received: unknown;
    const url = await endpoint(async (req, res) => {
      expect(req.method).toBe("POST");
      expect(req.url).toBe("/translate?api-version=3.0&to=zh-Hans");
      expect(req.headers["ocp-apim-subscription-key"]).toBe("secret");
      expect(req.headers["ocp-apim-subscription-region"]).toBe("eastasia");
      received = await bodyOf(req);
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify([
          {
            detectedLanguage: { language: "en", score: 1 },
            translations: [{ text: "你好", to: "zh-Hans" }],
          },
        ]),
      );
    });
    expect(
      await service().translate(
        {
          provider: "microsoft",
          endpoint: url,
          apiKey: "secret",
          region: "eastasia",
          language: "zh-CN",
        },
        "hello",
      ),
    ).toEqual({ status: "translated", text: "你好", sourceLanguage: "en" });
    expect(received).toEqual([{ Text: "hello" }]);
  });
  it("omits the region header for global resources", async () => {
    const url = await endpoint((req, res) => {
      expect(req.headers["ocp-apim-subscription-region"]).toBeUndefined();
      res.end(JSON.stringify([{ translations: [{ text: "你好" }] }]));
    });
    expect(
      await service().translate(
        {
          provider: "microsoft",
          endpoint: url,
          apiKey: "secret",
          region: "",
          language: "zh-TW",
        },
        "hello",
      ),
    ).toEqual({ status: "translated", text: "你好", sourceLanguage: null });
  });
  it("maps Chinese language codes and parses responses", () => {
    expect(microsoftLanguage("zh-CN")).toBe("zh-Hans");
    expect(microsoftLanguage("zh-TW")).toBe("zh-Hant");
    expect(microsoftLanguage("zh-HK")).toBe("zh-Hant");
    expect(microsoftLanguage("ja")).toBe("ja");
    expect(parseMicrosoft([{ translations: [{ text: "一" }] }])).toEqual({
      text: "一",
      sourceLanguage: null,
    });
    expect(() => parseMicrosoft([])).toThrow("Invalid translation response");
    expect(() => parseMicrosoft([{ translations: [] }])).toThrow("Invalid translation response");
  });
  it("reports authentication failures", async () => {
    const url = await endpoint((_req, res) => {
      res.writeHead(401).end();
    });
    expect(
      await service().translate(
        { provider: "microsoft", endpoint: url, apiKey: "bad", region: "", language: "zh-CN" },
        "hello",
      ),
    ).toEqual({ status: "error", code: "auth" });
  });
});

describe("configuration", () => {
  it("refuses to request when required credentials are missing", async () => {
    let requests = 0;
    const url = await endpoint((_req, res) => {
      requests += 1;
      res.end("[]");
    });
    const api = service();
    expect(
      await api.translate(
        { provider: "google-v2", endpoint: url, apiKey: "", language: "zh-CN" },
        "hello",
      ),
    ).toEqual({ status: "error", code: "config" });
    expect(
      await api.translate(
        {
          provider: "microsoft",
          endpoint: url,
          apiKey: "",
          region: "",
          language: "zh-CN",
        },
        "hello",
      ),
    ).toEqual({ status: "error", code: "config" });
    expect(requests).toBe(0);
  });
});
