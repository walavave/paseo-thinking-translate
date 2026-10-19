import type { PluginServerContext } from "@getpaseo/plugin/server";
import { settings, translate } from "./shared/contract";
import { TranslationService } from "./server/service";

export default function contribute(server: PluginServerContext) {
  const preferences = server.registerSettings(settings);
  let service = new TranslationService();
  const unsubscribe = preferences.subscribe(() => {
    service.dispose();
    service = new TranslationService();
  });
  server.handle(translate, async ({ texts }) => {
    const state = await preferences.read();
    if (state.status !== "ready") throw new Error("Translation settings are invalid");
    if (!state.values.enabled) {
      return {
        results: texts.map(() => ({ status: "error" as const, code: "disabled" as const })),
      };
    }
    const { endpoint, targetLanguage } = state.values;
    return {
      results: await Promise.all(
        texts.map((text) => service.translate(endpoint, targetLanguage, text)),
      ),
    };
  });
  return () => {
    unsubscribe();
    service.dispose();
  };
}
