import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQueries } from "@tanstack/react-query";
import { useRpc, useSettings, type PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { settings, translate, type Reasoning } from "../shared/contract";
import { parseMarkdown, translationTexts } from "../shared/markdown";
import { createBatchTranslator } from "./batch";
import { languageName } from "../shared/locale";
import { formatMessage, useLocale, useMessages } from "./i18n";
import { Markdown } from "./markdown";

export function Thinking({ item, theme, layout }: PluginTimelineItemProps<Reasoning>) {
  const m = useMessages();
  const locale = useLocale();
  const { text, phase } = item.data;
  const preferences = useSettings(settings);
  const rpc = useRpc(translate);
  const batch = useMemo(() => createBatchTranslator(rpc), [rpc]);
  const nodes = useMemo(() => parseMarkdown(text, phase), [text, phase]);
  const texts = useMemo(() => translationTexts(nodes), [nodes]);
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const [original, setOriginal] = useState(false);
  // Translation is lazy: a collapsed thought never sends its text anywhere.
  const expanded = manualExpanded ?? false;
  const values = preferences.status === "ready" ? preferences.values : null;
  const enabled = values?.enabled === true;
  const translating = enabled && expanded && !original;
  const targetLabel = languageName(values?.targetLanguage ?? "zh-CN", locale);
  const showTranslationLabel = formatMessage(m.showLanguage, { language: targetLabel });
  const translatingLabel = formatMessage(m.translatingTo, { language: targetLabel });
  const queries = useQueries({
    queries: texts.map((source) => ({
      // A settings revision prevents a late RPC from populating a later configuration's cache.
      queryKey: [
        "thinking-translate",
        preferences.status === "ready" ? preferences.revision : null,
        values?.provider,
        values?.googleVersion,
        values?.endpoint,
        values?.targetLanguage,
        source,
      ],
      queryFn: () => batch(source),
      enabled: translating,
      staleTime: Infinity,
      gcTime: 10 * 60 * 1000,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
    })),
  });
  const translations = new Map<string, string>();
  const errors = new Set<string>();
  let pending = false;
  queries.forEach((query, index) => {
    if (query.data?.status === "translated") translations.set(texts[index], query.data.text);
    else if (query.data?.status === "error") errors.add(m.failures[query.data.code]);
    else if (query.isError) errors.add(m.connectionFailed);
    if (query.isFetching) pending = true;
  });
  const colors = theme.colors;
  const label = { color: colors.foregroundMuted, fontSize: 12 };
  const button = { paddingVertical: 6, paddingHorizontal: 4 };
  return (
    <View style={{ gap: 6, minWidth: 0 }} testID="thinking-translate">
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thinking"
          accessibilityState={{ expanded }}
          onPress={() => setManualExpanded(!expanded)}
          style={button}
        >
          <Text style={label}>{expanded ? "\u2304" : "\u203a"} Thinking</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={original ? showTranslationLabel : m.showOriginal}
          onPress={() => setOriginal((value) => !value)}
          style={button}
        >
          <Text style={[label, { color: colors.accent }]}>
            {original ? targetLabel : m.original}
          </Text>
        </Pressable>
        {enabled && expanded && pending ? <Text style={label}>{translatingLabel}</Text> : null}
        {!enabled && preferences.status === "ready" ? (
          <Text style={label}>{m.autoDisabled}</Text>
        ) : null}
      </View>
      {expanded ? (
        <Markdown
          nodes={nodes}
          translations={original || !enabled ? new Map() : translations}
          theme={theme}
          compact={layout.compact}
        />
      ) : null}
      {enabled && expanded && errors.size ? (
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <Text accessibilityRole="alert" style={[label, { color: colors.statusWarning }]}>
            {Array.from(errors).join(m.listSeparator) + m.failuresSuffix}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={m.retryTranslation}
            style={button}
            disabled={pending}
            onPress={() => {
              queries.forEach((query) => {
                if (query.isError || query.data?.status === "error") void query.refetch();
              });
            }}
          >
            <Text style={[label, { color: colors.accent }]}>{m.retry}</Text>
          </Pressable>
        </View>
      ) : null}
      {preferences.status === "error" || preferences.status === "invalid" ? (
        <Text accessibilityRole="alert" style={[label, { color: colors.statusWarning }]}>
          {m.invalidSettings}
          {preferences.error}
        </Text>
      ) : null}
    </View>
  );
}
