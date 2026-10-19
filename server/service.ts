import type { TranslationResult } from "../shared/contract";

type Success = Extract<TranslationResult, { status: "translated" }>;
type Job = {
  key: string;
  endpoint: string;
  language: string;
  text: string;
  resolve(result: TranslationResult): void;
};

export function parseTranslation(value: unknown): Omit<Success, "status"> {
  if (!Array.isArray(value) || value.length !== 1 || !Array.isArray(value[0])) {
    throw new Error("Invalid translation response");
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
    throw new Error("Invalid translation response");
  const pairs = segments as [string, string | null][];
  return { text: pairs.map(([text]) => text).join(""), sourceLanguage: pairs[0][1] ?? null };
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

  translate(endpoint: string, language: string, text: string): Promise<TranslationResult> {
    if (this.disposed) return Promise.resolve({ status: "error", code: "disposed" });
    const key = JSON.stringify([endpoint, language, text]);
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
      this.queue.push({ key, endpoint, language, text, resolve });
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

  private async request(job: Job, controller: AbortController): Promise<TranslationResult> {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    try {
      const url = new URL(job.endpoint);
      url.searchParams.set("client", "dict-chrome-ex");
      url.searchParams.set("sl", "auto");
      url.searchParams.set("tl", job.language);
      url.searchParams.set("q", job.text);
      const response = await fetch(url, { signal: controller.signal, redirect: "error" });
      if (!response.ok) {
        await response.body?.cancel();
        return { status: "error", code: response.status === 429 ? "rate_limit" : "http" };
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
        return { status: "translated", ...parseTranslation(body) };
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
