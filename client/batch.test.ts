import { describe, expect, it } from "vitest";
import { createBatchTranslator } from "./batch";

describe("translation batching", () => {
  it("respects both text count and total size, retaining per-segment order", async () => {
    const batches: string[][] = [];
    const translate = createBatchTranslator(async ({ texts }) => {
      batches.push(texts);
      return {
        results: texts.map((text) => ({
          status: "translated",
          text: `result:${text}`,
          sourceLanguage: "en",
        })),
      };
    });
    const texts = Array.from({ length: 48 }, (_, index) => `${index}:` + "a".repeat(1490));
    const results = await Promise.all(texts.map(translate));
    expect(batches.every((batch) => batch.length <= 32 && batch.join("").length <= 12000)).toBe(
      true,
    );
    expect(results.map((result) => (result.status === "translated" ? result.text : null))).toEqual(
      texts.map((text) => `result:${text}`),
    );
  });
  it("rejects incomplete responses and transport errors, allowing manual retry", async () => {
    let attempts = 0;
    const translate = createBatchTranslator(async () => {
      attempts += 1;
      if (attempts === 1) return { results: [] };
      if (attempts === 2) throw new Error("offline");
      return { results: [{ status: "translated", text: "你好", sourceLanguage: "en" }] };
    });
    await expect(translate("hello")).rejects.toThrow("Incomplete");
    await expect(translate("hello")).rejects.toThrow("offline");
    await expect(translate("hello")).resolves.toMatchObject({ status: "translated", text: "你好" });
  });
});
