import type { FailureCode, TranslationResult } from "../shared/contract";

type Success = Extract<TranslationResult, { status: "translated" }>;

export type TranslationConfig =
  | { provider: "google-free"; language: string; endpoint: string }
  | { provider: "google-v2"; language: string; endpoint: string; apiKey: string }
  | {
      provider: "google-v3";
      language: string;
      endpoint: string;
      accessToken: string;
      projectId: string;
    }
  | {
      provider: "microsoft";
      language: string;
      endpoint: string;
      apiKey: string;
      region: string;
    };

type Job = {
  key: string;
  config: TranslationConfig;
  text: string;
  resolve(result: TranslationResult): void;
};

const invalidResponse = () => new Error("Invalid translation response");

function baseUrl(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
}

/** Google's keyless `translate_a/t` response, including split segments. */
export function parseTranslation(value: unknown): Omit<Success, "status"> {
  if (!Array.isArray(value) || value.length !== 1 || !Array.isArray(value[0])) {
    throw invalidResponse();
  }
  const segments: unknown[] = typeof value[0][0] === "string" ? [value[0]] : value[0];
  if (
    !segments.length ||
    !segments.every(
      (part) =>
        Array.isArray(part) &&
        typeof part[0] === "string" &&
        part[0].length > 0 &&
        (typeof part[1] === "string" || part[1] == null),
    )
  )
    throw invalidResponse();
  const pairs = segments as [string, string | null][];
  return { text: pairs.map(([text]) => text).join(""), sourceLanguage: pairs[0][1] ?? null };
}

/** Cloud Translation v2 (`data.translations[].translatedText`). */
export function parseGoogleV2(value: unknown): Omit<Success, "status"> {
  const translations = (value as { data?: { translations?: unknown } } | null)?.data?.translations;
  if (!Array.isArray(translations) || !translations.length) throw invalidResponse();
  const first = translations[0] as
    | { translatedText?: unknown; detectedSourceLanguage?: unknown }
    | undefined;
  if (!first || typeof first.translatedText !== "string" || !first.translatedText)
    throw invalidResponse();
  return {
    text: first.translatedText,
    sourceLanguage:
      typeof first.detectedSourceLanguage === "string" ? first.detectedSourceLanguage : null,
  };
}

/** Cloud Translation v3 (`translations[].translatedText`). */
export function parseGoogleV3(value: unknown): Omit<Success, "status"> {
  const translations = (value as { translations?: unknown } | null)?.translations;
  if (!Array.isArray(translations) || !translations.length) throw invalidResponse();
  const first = translations[0] as
    | { translatedText?: unknown; detectedLanguageCode?: unknown }
    | undefined;
  if (!first || typeof first.translatedText !== "string" || !first.translatedText)
    throw invalidResponse();
  return {
    text: first.translatedText,
    sourceLanguage:
      typeof first.detectedLanguageCode === "string" ? first.detectedLanguageCode : null,
  };
}

/** Microsoft Translator v3 (`[{ translations: [{ text }] }]`). */
export function parseMicrosoft(value: unknown): Omit<Success, "status"> {
  const first = Array.isArray(value) ? (value[0] as unknown) : undefined;
  if (!first || typeof first !== "object") throw invalidResponse();
  const translations = (first as { translations?: unknown }).translations;
  if (!Array.isArray(translations) || !translations.length) throw invalidResponse();
  const translation = translations[0] as { text?: unknown } | undefined;
  if (!translation || typeof translation.text !== "string" || !translation.text)
    throw invalidResponse();
  const detected = (first as { detectedLanguage?: { language?: unknown } }).detectedLanguage
    ?.language;
  return {
    text: translation.text,
    sourceLanguage: typeof detected === "string" ? detected : null,
  };
}

/** Microsoft uses `zh-Hans`/`zh-Hant` instead of Google's `zh-CN`/`zh-TW`. */
export function microsoftLanguage(language: string): string {
  const normalized = language.trim().toLowerCase();
  if (normalized === "zh-cn" || normalized === "zh-sg") return "zh-Hans";
  if (normalized === "zh-tw" || normalized === "zh-hk" || normalized === "zh-mo") return "zh-Hant";
  if (normalized === "no") return "nb";
  if (normalized === "tl") return "fil";
  return language;
}

export function isConfigured(config: TranslationConfig): boolean {
  switch (config.provider) {
    case "google-free":
      return config.endpoint.length > 0;
    case "google-v2":
      return config.endpoint.length > 0 && config.apiKey.length > 0;
    case "google-v3":
      return (
        config.endpoint.length > 0 && config.accessToken.length > 0 && config.projectId.length > 0
      );
    case "microsoft":
      return config.endpoint.length > 0 && config.apiKey.length > 0;
  }
}

function failureForStatus(status: number): FailureCode {
  if (status === 429) return "rate_limit";
  if (status === 401 || status === 403) return "auth";
  return "http";
}

export class TranslationService {
  private cache = new Map<string, Success>();
  private cacheBytes = 0;
  private pending = new Map<string, Promise<TranslationResult>>();
  private queue: Job[] = [];
  private controllers = new Set<AbortController>();
  private disposed = false;
  private readonly timeoutMs: number;
  private readonly maxEntries: number;

  constructor(options: { timeoutMs?: number; maxEntries?: number } = {}) {
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.maxEntries = options.maxEntries ?? 1000;
  }

  translate(config: TranslationConfig, text: string): Promise<TranslationResult> {
    if (this.disposed) return Promise.resolve({ status: "error", code: "disposed" });
    if (!isConfigured(config)) return Promise.resolve({ status: "error", code: "config" });
    const key = JSON.stringify([config, text]);
    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return Promise.resolve(cached);
    }
    const existing = this.pending.get(key);
    if (existing) return existing;
    if (this.pending.size >= 512) return Promise.resolve({ status: "error", code: "rate_limit" });
    const promise = new Promise<TranslationResult>((resolve) => {
      this.queue.push({ key, config, text, resolve });
    });
    this.pending.set(key, promise);
    this.pump();
    return promise;
  }

  dispose(): void {
    this.disposed = true;
    for (const controller of this.controllers) controller.abort();
    for (const job of this.queue.splice(0)) this.finish(job, { status: "error", code: "disposed" });
    this.cache.clear();
    this.cacheBytes = 0;
  }

  private pump(): void {
    while (!this.disposed && this.controllers.size < 2 && this.queue.length) {
      const job = this.queue.shift()!;
      const controller = new AbortController();
      this.controllers.add(controller);
      void this.request(job, controller).then((result) => {
        this.controllers.delete(controller);
        this.finish(job, result);
        this.pump();
      });
    }
  }

  private finish(job: Job, result: TranslationResult): void {
    this.pending.delete(job.key);
    if (result.status === "translated" && !this.disposed) {
      this.cache.set(job.key, result);
      this.cacheBytes += (job.key.length + result.text.length) * 2;
      while (this.cache.size > this.maxEntries || this.cacheBytes > 4 * 1024 * 1024) {
        const key = this.cache.keys().next().value;
        if (key === undefined) break;
        const entry = this.cache.get(key)!;
        this.cacheBytes -= (key.length + entry.text.length) * 2;
        this.cache.delete(key);
      }
    }
    job.resolve(result);
  }

  private requestInit(
    config: TranslationConfig,
    text: string,
    signal: AbortSignal,
  ): { url: URL; init: RequestInit } {
    switch (config.provider) {
      case "google-free": {
        const url = new URL(config.endpoint);
        url.searchParams.set("client", "dict-chrome-ex");
        url.searchParams.set("sl", "auto");
        url.searchParams.set("tl", config.language);
        url.searchParams.set("q", text);
        return { url, init: { signal, redirect: "error" } };
      }
      case "google-v2": {
        const root = baseUrl(config.endpoint);
        const url = new URL(
          /\/language\/translate\/v2$/i.test(root) ? root : `${root}/language/translate/v2`,
        );
        url.searchParams.set("key", config.apiKey);
        return {
          url,
          init: {
            method: "POST",
            signal,
            redirect: "error",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ q: text, target: config.language, format: "text" }),
          },
        };
      }
      case "google-v3": {
        const root = baseUrl(config.endpoint);
        const base = /\/v3$/i.test(root) ? root : `${root}/v3`;
        const url = new URL(
          `${base}/projects/${encodeURIComponent(config.projectId)}/locations/global:translateText`,
        );
        return {
          url,
          init: {
            method: "POST",
            signal,
            redirect: "error",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${config.accessToken}`,
            },
            body: JSON.stringify({
              contents: [text],
              targetLanguage: config.language,
              mimeType: "text/plain",
            }),
          },
        };
      }
      case "microsoft": {
        const url = new URL(`${baseUrl(config.endpoint)}/translate`);
        url.searchParams.set("api-version", "3.0");
        url.searchParams.set("to", microsoftLanguage(config.language));
        const headers: Record<string, string> = {
          "content-type": "application/json",
          "Ocp-Apim-Subscription-Key": config.apiKey,
        };
        if (config.region) headers["Ocp-Apim-Subscription-Region"] = config.region;
        return {
          url,
          init: {
            method: "POST",
            signal,
            redirect: "error",
            headers,
            body: JSON.stringify([{ Text: text }]),
          },
        };
      }
    }
  }

  private async request(job: Job, controller: AbortController): Promise<TranslationResult> {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    try {
      const { url, init } = this.requestInit(job.config, job.text, controller.signal);
      const response = await fetch(url, init);
      if (!response.ok) {
        await response.body?.cancel();
        return { status: "error", code: failureForStatus(response.status) };
      }
      // Keep the deadline active through body consumption, including stalled responses.
      let body: unknown;
      try {
        body = await response.json();
      } catch (error) {
        if (controller.signal.aborted) throw error;
        return { status: "error", code: "invalid_response" };
      }
      try {
        const parse =
          job.config.provider === "google-v2"
            ? parseGoogleV2
            : job.config.provider === "google-v3"
              ? parseGoogleV3
              : job.config.provider === "microsoft"
                ? parseMicrosoft
                : parseTranslation;
        return { status: "translated", ...parse(body) };
      } catch {
        return { status: "error", code: "invalid_response" };
      }
    } catch {
      return {
        status: "error",
        code: this.disposed ? "disposed" : timedOut ? "timeout" : "network",
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
