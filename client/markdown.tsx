import { useState, type ReactNode } from "react";
import { Linking, Platform, ScrollView, Text, View, type TextStyle } from "react-native";
import type { PluginTheme } from "@getpaseo/plugin";
import { textPieces, type MarkdownNode } from "../shared/markdown";
import { useMessages } from "./i18n";

export function Markdown({
  nodes,
  translations,
  theme,
  compact,
}: {
  nodes: MarkdownNode[];
  translations: ReadonlyMap<string, string>;
  theme: PluginTheme;
  compact: boolean;
}) {
  const m = useMessages();
  const [linkError, setLinkError] = useState<string | null>(null);
  const colors = theme.colors;
  const codeFont = Platform.OS === "ios" ? "Menlo" : "monospace";
  const base: TextStyle = { color: colors.foregroundMuted, fontSize: 13, lineHeight: 20 };
  function content(node: MarkdownNode): string {
    if (node.type !== "text" || !node.eligible) return node.text ?? "";
    return textPieces(node.text ?? "")
      .map((part) => (part.translate ? (translations.get(part.text) ?? part.text) : part.text))
      .join("");
  }
  function inline(node: MarkdownNode, key: number): ReactNode {
    const inner = node.children.map(inline);
    if (node.type === "text" || node.type === "literal") return content(node);
    const style: TextStyle =
      node.type === "strong"
        ? { fontWeight: "700" }
        : node.type === "emphasis"
          ? { fontStyle: "italic" }
          : node.type === "strike"
            ? { textDecorationLine: "line-through" }
            : node.type === "code"
              ? { fontFamily: codeFont, backgroundColor: colors.surface2, color: colors.foreground }
              : node.type === "link"
                ? { color: colors.accent, textDecorationLine: "underline" }
                : {};
    const safeUrl = node.url && /^https?:\/\//i.test(node.url) ? node.url : undefined;
    return (
      <Text
        key={key}
        style={style}
        accessibilityRole={safeUrl ? "link" : undefined}
        accessibilityLabel={safeUrl}
        onPress={
          safeUrl
            ? () => {
                void Linking.openURL(safeUrl).catch(() => setLinkError(m.openLinkFailed + safeUrl));
              }
            : undefined
        }
      >
        {node.type === "code" ? node.text : inner}
      </Text>
    );
  }
  function block(node: MarkdownNode, key: number): ReactNode {
    if (node.type === "paragraph" || node.type === "heading" || node.type === "cell") {
      const heading: TextStyle =
        node.type === "heading"
          ? {
              fontWeight: "700",
              fontSize: Math.max(14, 22 - (node.level ?? 1) * 2),
              color: colors.foreground,
            }
          : {};
      return (
        <Text key={key} selectable style={[base, heading]}>
          {node.children.map(inline)}
        </Text>
      );
    }
    if (node.type === "codeBlock")
      return (
        <ScrollView
          key={key}
          horizontal
          style={{ backgroundColor: colors.surface1, borderRadius: 4, padding: 8 }}
          accessibilityLabel={m.codeBlock}
        >
          <Text selectable style={[base, { fontFamily: codeFont, color: colors.foreground }]}>
            {node.text}
          </Text>
        </ScrollView>
      );
    if (node.type === "rule")
      return <View key={key} style={{ borderBottomWidth: 1, borderColor: colors.border }} />;
    if (node.type === "table")
      return (
        <ScrollView key={key} horizontal accessibilityLabel={m.table}>
          <View style={{ borderWidth: 1, borderColor: colors.border }}>
            {node.children.map((row, rowIndex) => (
              <View key={rowIndex} style={{ flexDirection: "row" }}>
                {row.children.map((cell, cellIndex) => (
                  <View
                    key={cellIndex}
                    style={{
                      width: compact ? 136 : 180,
                      padding: 6,
                      borderRightWidth: 1,
                      borderBottomWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: rowIndex === 0 ? colors.surface1 : undefined,
                    }}
                  >
                    {block(cell, cellIndex)}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      );
    if (node.type === "orderedList" || node.type === "bulletList") {
      return (
        <View key={key} style={{ gap: 4 }}>
          {node.children.map((item, index) => (
            <View key={index} style={{ flexDirection: "row", gap: 6 }}>
              <Text style={[base, { minWidth: 18, textAlign: "right" }]}>
                {node.type === "orderedList" ? `${(node.start ?? 1) + index}.` : "\u2022"}
              </Text>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>{item.children.map(block)}</View>
            </View>
          ))}
        </View>
      );
    }
    if (node.type === "quote")
      return (
        <View
          key={key}
          style={{ paddingLeft: 10, borderLeftWidth: 2, borderColor: colors.border, gap: 6 }}
        >
          {node.children.map(block)}
        </View>
      );
    if (node.children.length)
      return (
        <View key={key} style={{ gap: 6 }}>
          {node.children.map(block)}
        </View>
      );
    return (
      <Text key={key} selectable style={base}>
        {content(node)}
      </Text>
    );
  }
  return (
    <View style={{ gap: 8, minWidth: 0 }} testID="thinking-markdown">
      {nodes.map(block)}
      {linkError ? (
        <Text accessibilityRole="alert" style={[base, { color: colors.statusDanger }]}>
          {linkError}
        </Text>
      ) : null}
    </View>
  );
}
