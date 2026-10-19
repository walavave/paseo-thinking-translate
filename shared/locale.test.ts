import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, resolveLocale } from "./locale";

describe("resolveLocale", () => {
  it("honours a supported Paseo app language", () => {
    expect(resolveLocale("zh-CN", [])).toBe("zh-CN");
    expect(resolveLocale("ja", ["en-US"])).toBe("ja");
    expect(resolveLocale("pt-BR", [])).toBe("pt-BR");
  });
  it("falls back to Paseo's system-locale rules", () => {
    expect(resolveLocale("system", ["zh-TW"])).toBe("en");
    expect(resolveLocale("system", ["zh-Hans-CN"])).toBe("zh-CN");
    expect(resolveLocale("system", ["pt-BR"])).toBe("pt-BR");
    expect(resolveLocale("system", ["fr-CA"])).toBe("fr");
    expect(resolveLocale("system", ["de-DE"])).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("system", [])).toBe(DEFAULT_LOCALE);
  });
  it("ignores unsupported persisted values", () => {
    expect(resolveLocale("de", ["ko-KR"])).toBe("ko");
    expect(resolveLocale(null, ["ru"])).toBe("ru");
    expect(resolveLocale(undefined, [])).toBe(DEFAULT_LOCALE);
  });
});
