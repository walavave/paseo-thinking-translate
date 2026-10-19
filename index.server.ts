import type { PluginServerContext } from "@getpaseo/plugin/server";
import { settings, translate, type Settings, type TranslationResult } from "./shared/contract";
import { TranslationService, type TranslationConfig } from "./server/service";

export function translationConfig(values: Settings): TranslationConfig {
  const language = values.targetLanguage;
  switch (values.provider) {
    case "google-free":
      return { provider: "google-free", language, endpoint: values.endpoint };
    case "google-cloud":
      return values.googleVersion === "v2"
        ? {
            provider: "google-v2",
            language,
            endpoint: values.googleEndpoint,
            apiKey: values.googleApiKey,
          }
        : {
            provider: "google-v3",
            language,
            endpoint: values.googleEndpoint,
            accessToken: values.googleAccessToken,
            projectId: values.googleProjectId,
          };
    case "microsoft":
      return {
        provider: "microsoft",
        language,
        endpoint: values.microsoftEndpoint,
        apiKey: values.microsoftApiKey,
        region: values.microsoftRegion,
      };
  }
}

export default function contribute(server: PluginServerContext) {
  const preferences = server.registerSettings(settings);
  let service = new TranslationService();
  const unsubscribe = preferences.subscribe(() => {
    service.dispose();
    service = new TranslationService();
  });
  server.handle(translate, async ({ texts }) => {
    const state = await preferences.read();
    if (state.status !== "ready") {
      return {
        results: texts.map((): TranslationResult => ({ status: "error", code: "config" })),
      };
    }
    if (!state.values.enabled) {
      return {
        results: texts.map((): TranslationResult => ({ status: "error", code: "disabled" })),
      };
    }
    const config = translationConfig(state.values);
    return {
      results: await Promise.all(texts.map((text) => service.translate(config, text))),
    };
  });
  return () => {
    unsubscribe();
    service.dispose();
  };
}
