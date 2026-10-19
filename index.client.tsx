import type { PluginClientContext } from "@getpaseo/plugin/client";
import { reasoningSchema } from "./shared/contract";
import { Thinking } from "./client/thinking";
import { TranslationSettings } from "./client/settings";

export default function contribute(client: PluginClientContext) {
  client.addTimelineTransformer({
    id: "thinking-translate",
    query: { itemType: "reasoning" },
    transform: ({ item, phase }) => ({
      items: [
        {
          type: "plugin",
          kind: "thinking-translate",
          version: 1,
          data: { text: item.text, phase },
        },
      ],
    }),
  });
  client.addTimelineRenderer({
    kind: "thinking-translate",
    version: 1,
    schema: reasoningSchema,
    Component: Thinking,
  });
  client.addSettingsScreen({
    id: "translation",
    title: "Thinking 翻译",
    icon: "Languages",
    Component: TranslationSettings,
  });
  return () => {};
}
