import { describe, expect, it } from "vitest";
import { alignMarkdown } from "./align";

describe("alignMarkdown", () => {
  it("marks identical documents as unchanged rows", () => {
    const md = "# Title\n\nHello world.\n";
    const rows = alignMarkdown(md, md);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => !r.changed)).toBe(true);
    expect(rows[0]!.old?.type).toBe("heading");
    expect(rows[0]!.new?.type).toBe("heading");
  });

  it("pairs same-type edits into one changed row", () => {
    const rows = alignMarkdown("Hello world.\n", "Hello brave world.\n");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.changed).toBe(true);
    expect(rows[0]!.old?.normText).toBe("Hello world.");
    expect(rows[0]!.new?.normText).toBe("Hello brave world.");
  });

  it("marks pure insertions with missing before side", () => {
    const rows = alignMarkdown("# Only old\n", "# Only old\n\n## New\n");
    const inserted = rows.find((r) => r.new && !r.old);
    expect(inserted).toBeDefined();
    expect(inserted!.changed).toBe(true);
    expect(inserted!.new?.type).toBe("heading");
  });

  it("marks pure deletions with missing after side", () => {
    const rows = alignMarkdown("# Keep\n\nGone.\n", "# Keep\n");
    const deleted = rows.find((r) => r.old && !r.new);
    expect(deleted).toBeDefined();
    expect(deleted!.changed).toBe(true);
    expect(deleted!.old?.normText).toBe("Gone.");
  });

  it("keeps source line numbers on aligned blocks", () => {
    const rows = alignMarkdown("Para one\n\nPara two\n", "Para one\n\nPara two\n");
    expect(rows[0]!.old?.srcFrom).toBe(1);
    expect(rows[1]!.old?.srcFrom).toBe(3);
  });
});
