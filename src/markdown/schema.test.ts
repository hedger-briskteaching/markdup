import { describe, expect, it } from "vitest";
import { markdownSchema } from "./schema";

describe("markdownSchema", () => {
  it("registers CommonMark block nodes", () => {
    for (const name of [
      "doc",
      "paragraph",
      "blockquote",
      "horizontal_rule",
      "heading",
      "code_block",
      "ordered_list",
      "bullet_list",
      "list_item",
      "text",
      "image",
      "hard_break",
    ]) {
      expect(markdownSchema.nodes[name]).toBeDefined();
    }
  });

  it("registers GFM and extension nodes", () => {
    for (const name of [
      "table",
      "table_row",
      "table_header",
      "table_cell",
      "front_matter",
      "html_block",
    ]) {
      expect(markdownSchema.nodes[name]).toBeDefined();
    }
  });

  it("registers inline marks including strikethrough", () => {
    for (const name of ["em", "strong", "code", "link", "strikethrough"]) {
      expect(markdownSchema.marks[name]).toBeDefined();
    }
  });

  it("allows strong and code marks together", () => {
    const strong = markdownSchema.marks.strong.create();
    const code = markdownSchema.marks.code.create();
    const set = strong.addToSet([code]);
    expect(set).toHaveLength(2);
    expect(set.map((m) => m.type.name).sort()).toEqual(["code", "strong"]);
  });

  it("stores source line attrs on paragraphs", () => {
    const para = markdownSchema.node("paragraph", {
      srcFrom: 3,
      srcTo: 5,
    });
    expect(para.attrs.srcFrom).toBe(3);
    expect(para.attrs.srcTo).toBe(5);
  });

  it("stores task checked state on list items", () => {
    const item = markdownSchema.node("list_item", { checked: true, srcFrom: 1, srcTo: 1 }, [
      markdownSchema.node("paragraph", { srcFrom: 1, srcTo: 1 }),
    ]);
    expect(item.attrs.checked).toBe(true);
  });

  it("serializes table row source lines to the DOM", () => {
    const row = markdownSchema.node("table_row", { srcFrom: 5, srcTo: 5 }, [
      markdownSchema.node("table_cell", { srcFrom: 5, srcTo: 5 }),
    ]);
    const spec = markdownSchema.nodes.table_row.spec.toDOM!(row) as [
      string,
      Record<string, string>,
    ];
    expect(spec[0]).toBe("tr");
    expect(spec[1]).toEqual({ "data-src-from": "5", "data-src-to": "5" });
  });

  it("serializes list item source lines to the DOM", () => {
    const attrs = { checked: null, srcFrom: 2, srcTo: 3 };
    const item = markdownSchema.node("list_item", attrs, [
      markdownSchema.node("paragraph", { srcFrom: 2, srcTo: 3 }),
    ]);
    const spec = markdownSchema.nodes.list_item.spec.toDOM!(item) as [
      string,
      Record<string, string>,
    ];
    expect(spec[0]).toBe("li");
    expect(spec[1]).toMatchObject({
      "data-src-from": "2",
      "data-src-to": "3",
    });
  });

  it("keeps task item attributes alongside source lines", () => {
    const attrs = { checked: true, srcFrom: 4, srcTo: 4 };
    const item = markdownSchema.node("list_item", attrs, [
      markdownSchema.node("paragraph", { srcFrom: 4, srcTo: 4 }),
    ]);
    const spec = markdownSchema.nodes.list_item.spec.toDOM!(item) as [
      string,
      Record<string, string>,
    ];
    expect(spec[1]).toEqual({
      "data-src-from": "4",
      "data-src-to": "4",
      "data-task": "true",
      "data-checked": "true",
    });
  });

  it("omits source line attributes when the range is unknown", () => {
    const row = markdownSchema.node("table_row", {}, [markdownSchema.node("table_cell")]);
    const spec = markdownSchema.nodes.table_row.spec.toDOM!(row) as [
      string,
      Record<string, string>,
    ];
    expect(spec[1]).toEqual({});
  });
});
