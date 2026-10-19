import { parser, GFM } from "@lezer/markdown";
import type { SyntaxNode } from "@lezer/common";
import { decodeNamedCharacterReference } from "decode-named-character-reference";

export type NodeType =
  | "paragraph"
  | "heading"
  | "strong"
  | "emphasis"
  | "strike"
  | "text"
  | "literal"
  | "code"
  | "codeBlock"
  | "link"
  | "quote"
  | "bulletList"
  | "orderedList"
  | "listItem"
  | "table"
  | "row"
  | "cell"
  | "rule";
export type MarkdownNode = {
  type: NodeType;
  children: MarkdownNode[];
  from: number;
  to: number;
  eligible: boolean;
  text?: string;
  url?: string;
  level?: number;
  start?: number;
};

const markdown = parser.configure(GFM);
const markers = new Set([
  "EmphasisMark",
  "StrikethroughMark",
  "HeaderMark",
  "QuoteMark",
  "ListMark",
  "LinkMark",
  "LinkTitle",
  "TableDelimiter",
  "CodeMark",
  "CodeInfo",
]);
const containers: Record<string, NodeType> = {
  Paragraph: "paragraph",
  StrongEmphasis: "strong",
  Emphasis: "emphasis",
  Strikethrough: "strike",
  Blockquote: "quote",
  BulletList: "bulletList",
  OrderedList: "orderedList",
  ListItem: "listItem",
  Table: "table",
  TableHeader: "row",
  TableRow: "row",
  TableCell: "cell",
  Task: "paragraph",
};

function children(node: SyntaxNode): SyntaxNode[] {
  const result: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) result.push(child);
  return result;
}

function decodeEntity(text: string): string {
  if (text.startsWith("&#")) {
    const hex = text[2]?.toLowerCase() === "x";
    const code = Number.parseInt(text.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
      ? String.fromCodePoint(code)
      : "\ufffd";
  }
  return decodeNamedCharacterReference(text.slice(1, -1)) || text;
}

export function parseMarkdown(source: string, phase: "streaming" | "complete"): MarkdownNode[] {
  const tree = markdown.parse(source);
  const references = new Map<string, string>();
  const labelKey = (label: string) => label.trim().replace(/\s+/g, " ").toLowerCase();
  function readReferences(node: SyntaxNode) {
    if (node.name === "LinkReference") {
      const parts = children(node);
      const label = parts.find((child) => child.name === "LinkLabel");
      const url = parts.find((child) => child.name === "URL");
      if (label && url) {
        const key = labelKey(source.slice(label.from + 1, label.to - 1));
        if (!references.has(key)) references.set(key, source.slice(url.from, url.to));
      }
    }
    children(node).forEach(readReferences);
  }
  readReferences(tree.topNode);
  let boundary = phase === "complete" ? source.length : 0;
  if (phase === "streaming") {
    for (const match of source.matchAll(/\r?\n[ \t]*\r?\n/g)) {
      boundary = match.index! + match[0].length;
    }
  }

  function make(node: SyntaxNode, type: NodeType, eligible: boolean): MarkdownNode {
    return { type, from: node.from, to: node.to, eligible, children: [] };
  }
  function inline(
    node: SyntaxNode,
    eligible: boolean,
    from = node.from,
    to = node.to,
  ): MarkdownNode[] {
    const result: MarkdownNode[] = [];
    let cursor = from;
    const gap = (end: number) => {
      if (end > cursor)
        result.push({
          type: "text",
          from: cursor,
          to: end,
          text: source.slice(cursor, end),
          eligible,
          children: [],
        });
    };
    for (const child of children(node)) {
      if (child.to <= from || child.from >= to) continue;
      gap(child.from);
      const converted = convert(child, eligible);
      if (converted) result.push(converted);
      cursor = child.to;
    }
    gap(to);
    return result;
  }
  function convert(node: SyntaxNode, eligible: boolean): MarkdownNode | null {
    const name = node.name;
    if (markers.has(name) || name === "LinkReference") return null;
    if (name === "URL") {
      const text = source.slice(node.from, node.to);
      return {
        ...make(node, "link", false),
        url: text,
        children: [{ ...make(node, "literal", false), text }],
      };
    }
    if (name === "Escape" || name === "Entity" || name === "HardBreak" || name === "TaskMarker") {
      const text = source.slice(node.from, node.to);
      return {
        ...make(node, "literal", false),
        text:
          name === "Escape"
            ? text.slice(1)
            : name === "Entity"
              ? decodeEntity(text)
              : name === "HardBreak"
                ? "\n"
                : text === "[x]" || text === "[X]"
                  ? "[x] "
                  : "[ ] ",
      };
    }
    if (name === "InlineCode") {
      const marks = children(node).filter((child) => child.name === "CodeMark");
      let text = source.slice(marks[0].to, marks[marks.length - 1].from).replace(/\r?\n/g, " ");
      if (/^ .* $/.test(text) && /[^ ]/.test(text)) text = text.slice(1, -1);
      return { ...make(node, "code", false), text };
    }
    if (name === "FencedCode" || name === "CodeBlock") {
      const parts = children(node);
      const text = parts
        .filter((child) => child.name === "CodeText")
        .map((child) => source.slice(child.from, child.to))
        .join("");
      return { ...make(node, "codeBlock", false), text };
    }
    if (name === "Link" || name === "Image" || name === "Autolink") {
      const parts = children(node);
      const urlNode = parts.find((child) => child.name === "URL");
      let url = urlNode
        ? source
            .slice(urlNode.from, urlNode.to)
            .replace(/\\([\\()])/g, "$1")
            .replace(/&(?:#(?:x[\da-f]+|\d+)|[a-z]+);/gi, decodeEntity)
        : undefined;
      const close = parts.find(
        (child) => child.name === "LinkMark" && source.slice(child.from, child.to) === "]",
      );
      if (!url && close) {
        const label = parts.find((child) => child.name === "LinkLabel");
        const reference = label ? source.slice(label.from + 1, label.to - 1) : "";
        url = references.get(labelKey(reference || source.slice(parts[0].to, close.from)));
      }
      if (!url) return { ...make(node, "literal", false), text: source.slice(node.from, node.to) };
      return {
        ...make(node, "link", eligible),
        url,
        children: close
          ? inline(node, eligible, parts[0].to, close.from)
          : [{ ...make(node, "literal", false), text: url ?? source.slice(node.from, node.to) }],
      };
    }
    if (name === "HorizontalRule") return make(node, "rule", false);
    const heading = /^(?:ATX|Setext)Heading(\d)$/.exec(name);
    const type = heading ? "heading" : containers[name];
    if (!type) return { ...make(node, "literal", false), text: source.slice(node.from, node.to) };
    const result = make(node, type, eligible);
    if (heading) result.level = Number(heading[1]);
    if (type === "orderedList") result.start = Number.parseInt(source.slice(node.from), 10) || 1;
    if (["paragraph", "heading", "strong", "emphasis", "strike", "cell"].includes(type)) {
      result.children = inline(node, eligible);
    } else {
      result.children = children(node).flatMap((child) => {
        const converted = convert(child, eligible);
        return converted ? [converted] : [];
      });
    }
    return result;
  }
  return children(tree.topNode).flatMap((node) => {
    const converted = convert(node, phase === "complete" || node.to < boundary);
    return converted ? [converted] : [];
  });
}

export type TextPiece = { text: string; translate: boolean };

export function textPieces(text: string): TextPiece[] {
  const pieces: TextPiece[] = [];
  // URL-shaped plain text is protected even when CommonMark doesn't recognize an autolink.
  for (const token of text.split(/((?:https?:\/\/|www\.)[^\s<>]+|\s+)/g).filter(Boolean)) {
    if (/^(?:https?:\/\/|www\.)/.test(token) || /^\s+$/.test(token)) {
      pieces.push({ text: token, translate: false });
      continue;
    }
    // Coalesce words and spaces later; split only oversized runs at a code-point boundary.
    const previous = pieces[pieces.length - 1];
    if (previous && previous.translate && previous.text.length + token.length <= 1500) {
      previous.text += token;
    } else {
      let remaining = token;
      while (remaining.length) {
        let end = Math.min(1500, remaining.length);
        if (end < remaining.length && /[\uD800-\uDBFF]/.test(remaining[end - 1])) end -= 1;
        const part = remaining.slice(0, end);
        pieces.push({ text: part, translate: /[\p{L}\p{N}]/u.test(part) });
        remaining = remaining.slice(end);
      }
    }
  }
  // Join internal whitespace to preserve sentence context for the translation engine.
  const joined: TextPiece[] = [];
  for (let index = 0; index < pieces.length; index += 1) {
    const part = pieces[index];
    const previous = joined[joined.length - 1];
    const next = pieces[index + 1];
    if (
      !part.translate &&
      /^\s+$/.test(part.text) &&
      previous?.translate &&
      next?.translate &&
      previous.text.length + part.text.length + next.text.length <= 1500
    ) {
      previous.text += part.text + next.text;
      index += 1;
    } else if (
      part.translate &&
      previous?.translate &&
      previous.text.length + part.text.length <= 1500
    ) {
      previous.text += part.text;
    } else joined.push({ ...part });
  }
  return joined;
}

export function translationTexts(nodes: MarkdownNode[]): string[] {
  const texts = new Set<string>();
  function visit(node: MarkdownNode) {
    if (node.type === "text" && node.eligible) {
      for (const part of textPieces(node.text ?? "")) if (part.translate) texts.add(part.text);
    }
    node.children.forEach(visit);
  }
  nodes.forEach(visit);
  return [...texts];
}
