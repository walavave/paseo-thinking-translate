import { describe, expect, it } from "vitest";
import { parseMarkdown, textPieces, translationTexts, type MarkdownNode } from "./markdown";

function all(nodes: MarkdownNode[]): MarkdownNode[] {
  return nodes.flatMap((node) => [node, ...all(node.children)]);
}

describe("structured Markdown translation", () => {
  it("preserves indented code lines and resolves reference links without translating destinations", () => {
    const document = parseMarkdown(
      '[docs]: https://example.com "Title"\n\n[Read][docs] [docs][] [docs]\n\n    if (ok) {\n      run("**");\n    }\n',
      "complete",
    );
    const nodes = all(document);
    expect(nodes.filter((node) => node.type === "link").map((node) => node.url)).toEqual(
      Array.from({ length: 3 }, () => "https://example.com"),
    );
    expect(nodes.find((node) => node.type === "codeBlock")?.text).toBe(
      'if (ok) {\n  run("**");\n}',
    );
    expect(translationTexts(document)).toEqual(["Read", "docs"]);
  });
  it("parses nested styles, headings, lists, blockquotes, strikethrough and tables", () => {
    const source =
      "# Heading\n\n**bold *nested*** and ~~gone~~.\n\n1. first\n   - nested item\n\n> quoted\n\n| Name | Value |\n| --- | --- |\n| One | Two |";
    const document = parseMarkdown(source, "complete");
    const types = all(document).map((node) => node.type);
    for (const type of [
      "heading",
      "strong",
      "emphasis",
      "strike",
      "orderedList",
      "bulletList",
      "quote",
      "table",
      "cell",
    ]) {
      expect(types).toContain(type);
    }
    const texts = translationTexts(document);
    expect(texts).toContain("nested");
    expect(texts).toContain("Heading");
    expect(texts.join(" ")).not.toMatch(/\*\*|~~|^#/);
  });
  it("protects code, links, escaped stars, entities, and literal URL labels", () => {
    const document = parseMarkdown(
      "Use `a ** b` and [the **docs**](https://example.com/a?x=1&y=2).\n\n\\*literal\\* &amp; &#42;\n\nhttps://example.org\n\n```js\nconst x = '**code**';\n```",
      "complete",
    );
    const nodes = all(document);
    expect(nodes.find((node) => node.type === "codeBlock")?.text).toBe("const x = '**code**';");
    expect(nodes.find((node) => node.type === "code")?.text).toBe("a ** b");
    expect(nodes.find((node) => node.type === "link")?.url).toBe("https://example.com/a?x=1&y=2");
    expect(
      nodes
        .filter((node) => node.type === "literal")
        .map((node) => node.text)
        .join(""),
    ).toContain("*");
    const texts = translationTexts(document);
    expect(texts).toContain("docs");
    expect(texts.join("")).not.toMatch(/https:|code|a \*\* b|&amp;|\\\*/);
    expect(nodes.some((node) => node.type === "link" && node.url === "https://example.org")).toBe(
      true,
    );
  });
  it("keeps unresolved references visible with their literal brackets", () => {
    const nodes = all(parseMarkdown("[unknown] and [label][missing]", "complete"));
    expect(nodes.filter((node) => node.type === "literal").map((node) => node.text)).toEqual([
      "[unknown]",
      "[label][missing]",
    ]);
  });
  it("only translates closed streaming blocks and preserves an unclosed tail", () => {
    const source = "First **paragraph**.\n\nTail **still";
    const streaming = parseMarkdown(source, "streaming");
    expect(translationTexts(streaming)).toEqual(["First", "paragraph"]);
    expect(translationTexts(parseMarkdown(source, "complete"))).toContain("Tail **still");
    expect(translationTexts(parseMarkdown("unfinished", "streaming"))).toEqual([]);
    expect(translationTexts(parseMarkdown("closed\n\n", "streaming"))).toEqual(["closed"]);
  });
  it("keeps whitespace and Unicode intact when splitting long text", () => {
    const source = "  " + "hello 🦊 world. ".repeat(600) + "\n";
    const pieces = textPieces(source);
    expect(pieces.map((part) => part.text).join("")).toBe(source);
    expect(pieces.every((part) => part.text.length <= 1500)).toBe(true);
    expect(pieces.some((part) => /\p{Surrogate}/u.test(part.text))).toBe(false);
  });
  it("keys reusable segments by exact content and rejects stale changed segments", () => {
    expect(translationTexts(parseMarkdown("Old text\n\nTail", "streaming"))).toEqual(["Old text"]);
    expect(translationTexts(parseMarkdown("New text\n\nTail grows", "streaming"))).toEqual([
      "New text",
    ]);
    expect(translationTexts(parseMarkdown("Same\n\nSame", "complete"))).toEqual(["Same"]);
  });
});
