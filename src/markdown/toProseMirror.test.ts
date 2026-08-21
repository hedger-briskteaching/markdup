import type { Node as PMNode } from "prosemirror-model";
import { Mark } from "prosemirror-model";
import { describe, expect, it } from "vitest";
import { markdownToDoc, parseMarkdown } from "./index";
import { srcRangeFromNode } from "./positions";
import { markdownSchema } from "./schema";

describe("parseMarkdown", () => {
  it("attaches source positions to paragraphs", () => {
    const tree = parseMarkdown("Hello\n\nWorld\n");
    expect(tree.children).toHaveLength(2);
    expect(srcRangeFromNode(tree.children[0]!)).toEqual({ from: 1, to: 1 });
    expect(srcRangeFromNode(tree.children[1]!)).toEqual({ from: 3, to: 3 });
  });
});

describe("markdownToDoc", () => {
  it("converts a paragraph with nested strong and code marks", () => {
    const doc = markdownToDoc("Use **`V2ActionMenu`** in the toolbar.\n");
    const para = doc.child(0);
    expect(para.type.name).toBe("paragraph");
    const textNode = para.child(1);
    expect(textNode.isText).toBe(true);
    expect(textNode.text).toBe("V2ActionMenu");
    const names = textNode.marks.map((m) => m.type.name).sort();
    expect(names).toEqual(["code", "strong"]);
  });

  it("converts headings with source lines", () => {
    const doc = markdownToDoc("# Title\n\n## Section\n");
    expect(doc.child(0).type.name).toBe("heading");
    expect(doc.child(0).attrs.level).toBe(1);
    expect(doc.child(0).attrs.srcFrom).toBe(1);
    expect(doc.child(1).attrs.level).toBe(2);
    expect(doc.child(1).attrs.srcFrom).toBe(3);
  });

  it("converts YAML front matter to a front_matter node", () => {
    const doc = markdownToDoc("---\nstatus: in review\nowner: jgable\n---\n\n# Plan\n");
    const fm = doc.child(0);
    expect(fm.type.name).toBe("front_matter");
    expect(fm.attrs.value).toContain("status: in review");
    expect(fm.attrs.srcFrom).toBe(1);
    expect(doc.child(1).type.name).toBe("heading");
  });

  it("converts bullet lists and keeps item source lines", () => {
    const doc = markdownToDoc("- one\n- two\n");
    const list = doc.child(0);
    expect(list.type.name).toBe("bullet_list");
    expect(list.childCount).toBe(2);
    expect(list.child(0).type.name).toBe("list_item");
    expect(list.child(0).attrs.checked).toBeNull();
    expect(list.child(0).attrs.srcFrom).toBe(1);
    expect(list.child(1).attrs.srcFrom).toBe(2);
  });

  it("converts GFM task list items", () => {
    const doc = markdownToDoc("- [x] done\n- [ ] todo\n");
    const list = doc.child(0);
    expect(list.child(0).attrs.checked).toBe(true);
    expect(list.child(1).attrs.checked).toBe(false);
  });

  it("converts GFM tables with cell text", () => {
    const doc = markdownToDoc("| Milestone | State |\n| --- | --- |\n| 6-7 | not started |\n");
    const table = doc.child(0);
    expect(table.type.name).toBe("table");
    expect(table.childCount).toBe(2);
    const header = table.child(0);
    expect(header.child(0).type.name).toBe("table_header");
    expect(header.child(0).textContent).toBe("Milestone");
    const body = table.child(1);
    expect(body.child(1).type.name).toBe("table_cell");
    expect(body.child(1).textContent).toBe("not started");
  });

  it("converts fenced code blocks with language params", () => {
    const doc = markdownToDoc("```ts\nconst x = 1\n```\n");
    const block = doc.child(0);
    expect(block.type.name).toBe("code_block");
    expect(block.attrs.params).toBe("ts");
    expect(block.textContent).toBe("const x = 1");
  });

  it("converts strikethrough marks", () => {
    const doc = markdownToDoc("This is ~~gone~~.\n");
    const para = doc.child(0);
    const struck = findText(para, "gone");
    expect(struck).toBeDefined();
    expect(Mark.sameSet(struck!.marks, [markdownSchema.marks.strikethrough.create()])).toBe(true);
  });

  it("resolves reference links to href marks", () => {
    const doc = markdownToDoc('See [Design Contract][dc].\n\n[dc]: https://example.com/dc "DC"\n');
    const para = doc.child(0);
    const linkText = findText(para, "Design Contract");
    expect(linkText).toBeDefined();
    const link = linkText!.marks.find((m) => m.type.name === "link");
    expect(link?.attrs.href).toBe("https://example.com/dc");
    expect(link?.attrs.title).toBe("DC");
  });

  it("stores raw HTML blocks", () => {
    const doc = markdownToDoc('<div class="note">Hi</div>\n');
    const block = doc.child(0);
    expect(block.type.name).toBe("html_block");
    expect(block.attrs.html).toContain("div");
  });

  it("converts blockquotes and thematic breaks", () => {
    const doc = markdownToDoc("> quoted\n\n---\n");
    expect(doc.child(0).type.name).toBe("blockquote");
    expect(doc.child(1).type.name).toBe("horizontal_rule");
  });

  it("returns an empty paragraph doc for blank input", () => {
    const doc = markdownToDoc("");
    expect(doc.childCount).toBe(1);
    expect(doc.child(0).type.name).toBe("paragraph");
  });
});

function findText(parent: PMNode, value: string): PMNode | undefined {
  let found: PMNode | undefined;
  parent.descendants((node) => {
    if (node.isText && node.text === value) {
      found = node;
      return false;
    }
    return undefined;
  });
  return found;
}
