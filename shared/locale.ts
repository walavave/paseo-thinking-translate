export const locales = ["ar", "en", "es", "fr", "ja", "ko", "pt-BR", "ru", "zh-CN"] as const;
export type Locale = (typeof locales)[number];

export const DEFAULT_LOCALE: Locale = "en";

const supported = new Set<string>(locales);
const regional: Readonly<Record<string, Locale>> = {
  ar: "ar",
  en: "en",
  es: "es",
  fr: "fr",
  ja: "ja",
  ko: "ko",
  ru: "ru",
};

/** Paseo supports `system` plus a fixed locale list; anything else falls back. */
export function resolveLocale(
  language: string | null | undefined,
  systemLocales: readonly string[],
): Locale {
  if (language && language !== "system" && supported.has(language)) {
    return language as Locale;
  }
  for (const locale of systemLocales) {
    const normalized = locale.toLowerCase();
    const base = normalized.split("-", 1)[0];
    const match = regional[base];
    if (match) return match;
    if (normalized === "pt" || normalized === "pt-br") return "pt-BR";
    if (normalized === "zh" || normalized === "zh-cn" || normalized.startsWith("zh-hans")) {
      return "zh-CN";
    }
  }
  return DEFAULT_LOCALE;
}

export function systemLocales(): string[] {
  const nav = (globalThis as { navigator?: { languages?: readonly string[]; language?: string } })
    .navigator;
  if (nav?.languages?.length) return [...nav.languages];
  if (nav?.language) return [nav.language];
  try {
    return [Intl.DateTimeFormat().resolvedOptions().locale];
  } catch {
    return [];
  }
}

/** Localized language name for a translation target, e.g. `ja` → 日本語 / Japanese. */
export function languageName(code: string, locale: Locale): string {
  const normalized = code.trim().replace(/_/g, "-");
  if (!normalized) return code;
  const lower = normalized.toLowerCase();
  const displayCode =
    lower === "zh-cn" || lower === "zh-sg" || lower.startsWith("zh-hans")
      ? "zh-Hans"
      : lower === "zh-tw" || lower === "zh-hk" || lower === "zh-mo" || lower.startsWith("zh-hant")
        ? "zh-Hant"
        : normalized;
  try {
    const names = new Intl.DisplayNames([locale], { type: "language", fallback: "code" });
    return names.of(displayCode) ?? normalized;
  } catch {
    return normalized;
  }
}
