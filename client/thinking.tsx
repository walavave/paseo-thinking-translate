import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQueries } from "@tanstack/react-query";
import { useRpc, useSettings, type PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { settings, translate, type Reasoning } from "../shared/contract";
import { parseMarkdown, translationTexts } from "../shared/markdown";
import { createBatchTranslator } from "./batch";
import { Markdown } from "./markdown";

const failures: Record<string, string> = {
  network: "网络错误",
  timeout: "请求超时",
  rate_limit: "请求被限流",
  http: "服务返回错误",
  invalid_response: "服务响应格式异常",
  disposed: "翻译已取消",
  disabled: "自动翻译已关闭",
};

export function Thinking({ item, theme, layout }: PluginTimelineItemProps<Reasoning>) {
  const { text, phase } = item.data;
  const preferences = useSettings(settings);
  const rpc = useRpc(translate);
  const batch = useMemo(() => createBatchTranslator(rpc), [rpc]);
  const nodes = useMemo(() => parseMarkdown(text, phase), [text, phase]);
  const texts = useMemo(() => translationTexts(nodes), [nodes]);
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const [original, setOriginal] = useState(false);
  const expanded = manualExpanded ?? phase === "streaming";
  const values = preferences.status === "ready" ? preferences.values : null;
  const enabled = values?.enabled === true;
  const translationLabel = /^zh(?:-|$)/i.test(values?.targetLanguage ?? "zh-CN") ? "中文" : "译文";
  const queries = useQueries({
    queries: texts.map((source) => ({
      // A settings revision prevents a late RPC from populating a later configuration's cache.
      queryKey: [
        "thinking-translate",
        preferences.status === "ready" ? preferences.revision : null,
        values?.endpoint,
        values?.targetLanguage,
        source,
      ],
      queryFn: () => batch(source),
      enabled,
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
    else if (query.data?.status === "error") errors.add(failures[query.data.code]);
    else if (query.isError) errors.add("翻译连接失败");
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
          accessibilityLabel={original ? `显示${translationLabel}` : "显示原文"}
          onPress={() => setOriginal((value) => !value)}
          style={button}
        >
          <Text style={[label, { color: colors.accent }]}>
            {original ? translationLabel : "原文"}
          </Text>
        </Pressable>
        {enabled && pending ? <Text style={label}>翻译中…</Text> : null}
        {!enabled && preferences.status === "ready" ? (
          <Text style={label}>自动翻译已关闭</Text>
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
      {enabled && errors.size ? (
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <Text accessibilityRole="alert" style={[label, { color: colors.statusWarning }]}>
            {Array.from(errors).join("；")}，失败部分显示原文。
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="重试翻译"
            style={button}
            disabled={pending}
            onPress={() => {
              queries.forEach((query) => {
                if (query.isError || query.data?.status === "error") void query.refetch();
              });
            }}
          >
            <Text style={[label, { color: colors.accent }]}>重试</Text>
          </Pressable>
        </View>
      ) : null}
      {preferences.status === "error" || preferences.status === "invalid" ? (
        <Text accessibilityRole="alert" style={[label, { color: colors.statusWarning }]}>
          无法读取翻译设置：{preferences.error}
        </Text>
      ) : null}
    </View>
  );
}
