import type {
  BlockContent,
  Content,
  Definition,
  Heading,
  List,
  ListItem,
  Nodes,
  Parents,
  PhrasingContent,
  Root,
  Table,
  TableCell,
  TableRow,
  YAML,
} from "mdast";
import { Mark, type Node as PMNode } from "prosemirror-model";
import { srcAttrsFromNode } from "./positions";
import { markdownSchema } from "./schema";

type Align = "left" | "right" | "center" | null;

/**
 * Convert an mdast tree into a ProseMirror document that uses `markdownSchema`.
 * @param tree - Root node of the mdast syntax tree.
 * @returns A ProseMirror doc node.
 */
export function mdastToProseMirror(tree: Root): PMNode {
  const defs = collectDefinitions(tree);
  const blocks = tree.children
    .map((child) => blockToNode(child, defs))
    .filter((n): n is PMNode => n !== null);

  if (blocks.length === 0) {
    return markdownSchema.node("doc", null, [
      markdownSchema.node("paragraph", { srcFrom: null, srcTo: null }),
    ]);
  }

  return markdownSchema.node("doc", null, blocks);
}

/**
 * Collect all link/image reference definitions from the tree.
 * @param tree - Root mdast node.
 * @returns A map from lowercase identifier to its definition node.
 */
function collectDefinitions(tree: Root): Map<string, Definition> {
  const defs = new Map<string, Definition>();
  walk(tree, (node) => {
    if (node.type === "definition") {
      defs.set(node.identifier.toLowerCase(), node);
    }
  });
  return defs;
}

/**
 * Recursively walk every node in an mdast tree and run a visitor on each one.
 * @param node - Current node.
 * @param visit - Callback to run for each node.
 * @returns Nothing.
 */
function walk(node: Nodes, visit: (node: Nodes) => void): void {
  visit(node);
  if ("children" in node && Array.isArray(node.children)) {
    for (const child of node.children as Nodes[]) {
      walk(child, visit);
    }
  }
}

/**
 * Convert a single mdast block-level node into a ProseMirror node.
 * @param node - An mdast content or block node.
 * @param defs - Collected reference definitions for link/image resolution.
 * @returns The ProseMirror node, or `null` if the block type is not rendered.
 */
function blockToNode(
  node: Content | BlockContent | YAML,
  defs: Map<string, Definition>,
): PMNode | null {
  const src = srcAttrsFromNode(node);

  switch (node.type) {
    case "yaml":
      return markdownSchema.node("front_matter", {
        ...src,
        value: node.value,
      });

    case "paragraph":
      return markdownSchema.node("paragraph", src, phrasingToInline(node.children, defs));

    case "heading":
      return markdownSchema.node(
        "heading",
        { ...src, level: clampHeadingLevel(node) },
        phrasingToInline(node.children, defs),
      );

    case "blockquote":
      return markdownSchema.node("blockquote", src, childrenBlocks(node, defs));

    case "thematicBreak":
      return markdownSchema.node("horizontal_rule", src);

    case "code":
      return markdownSchema.node(
        "code_block",
        { ...src, params: node.lang ?? "" },
        node.value ? [markdownSchema.text(node.value)] : [],
      );

    case "list":
      return listToNode(node, defs);

    case "table":
      return tableToNode(node, defs);

    case "html":
      return markdownSchema.node("html_block", {
        ...src,
        html: node.value,
      });

    case "definition":
    case "footnoteDefinition":
      // Reference targets are resolved into links. Definitions are not rendered.
      return null;

    default:
      // Unknown block type. Skip it instead of failing the whole file.
      return null;
  }
}

/**
 * Clamp an mdast heading depth to the valid 1-6 range.
 * @param node - An mdast heading node.
 * @returns The clamped level number.
 */
function clampHeadingLevel(node: Heading): number {
  const level = node.depth;
  if (level < 1) return 1;
  if (level > 6) return 6;
  return level;
}

/**
 * Convert a parent node's children into an array of ProseMirror block nodes.
 * An empty paragraph is added when no children produce output.
 * @param parent - Any mdast parent node.
 * @param defs - Collected reference definitions.
 * @returns Array of ProseMirror block nodes (at least one).
 */
function childrenBlocks(parent: Parents, defs: Map<string, Definition>): PMNode[] {
  const out: PMNode[] = [];
  for (const child of parent.children) {
    const n = blockToNode(child as Content, defs);
    if (n) out.push(n);
  }
  if (out.length === 0) {
    out.push(markdownSchema.node("paragraph", { srcFrom: null, srcTo: null }));
  }
  return out;
}

/**
 * Convert an mdast list into a ProseMirror `ordered_list` or `bullet_list` node.
 * @param node - An mdast list node.
 * @param defs - Collected reference definitions.
 * @returns The ProseMirror list node.
 */
function listToNode(node: List, defs: Map<string, Definition>): PMNode {
  const src = srcAttrsFromNode(node);
  const items = node.children.map((item) => listItemToNode(item, defs));
  if (node.ordered) {
    return markdownSchema.node(
      "ordered_list",
      {
        ...src,
        order: node.start ?? 1,
        tight: node.spread === false || node.spread === undefined,
      },
      items,
    );
  }
  return markdownSchema.node(
    "bullet_list",
    {
      ...src,
      tight: node.spread === false || node.spread === undefined,
    },
    items,
  );
}

/**
 * Convert an mdast list item into a ProseMirror `list_item` node.
 * @param node - An mdast list-item node.
 * @param defs - Collected reference definitions.
 * @returns The ProseMirror list-item node.
 */
function listItemToNode(node: ListItem, defs: Map<string, Definition>): PMNode {
  const src = srcAttrsFromNode(node);
  const checked = typeof node.checked === "boolean" ? node.checked : null;
  const content = childrenBlocks(node, defs);
  return markdownSchema.node("list_item", { ...src, checked }, content);
}

/**
 * Convert an mdast table into a ProseMirror `table` node.
 * @param node - An mdast table node.
 * @param defs - Collected reference definitions.
 * @returns The ProseMirror table node.
 */
function tableToNode(node: Table, defs: Map<string, Definition>): PMNode {
  const src = srcAttrsFromNode(node);
  const aligns = node.align ?? [];
  const rows = node.children.map((row, rowIndex) =>
    tableRowToNode(row, aligns, defs, rowIndex === 0),
  );
  return markdownSchema.node("table", src, rows);
}

/**
 * Convert an mdast table row into a ProseMirror `table_row` node.
 * @param row - An mdast table-row node.
 * @param aligns - Column alignment array from the parent table.
 * @param defs - Collected reference definitions.
 * @param isHeader - `true` when this is the first (header) row.
 * @returns The ProseMirror table-row node.
 */
function tableRowToNode(
  row: TableRow,
  aligns: Array<Align | undefined | null>,
  defs: Map<string, Definition>,
  isHeader: boolean,
): PMNode {
  const src = srcAttrsFromNode(row);
  const cells = row.children.map((cell, i) =>
    tableCellToNode(cell, aligns[i] ?? null, defs, isHeader),
  );
  return markdownSchema.node("table_row", src, cells);
}

/**
 * Convert an mdast table cell into a ProseMirror `table_header` or `table_cell` node.
 * @param cell - An mdast table-cell node.
 * @param align - Column alignment for this cell (`null` when unset).
 * @param defs - Collected reference definitions.
 * @param isHeader - `true` when the cell belongs to the header row.
 * @returns The ProseMirror cell node.
 */
function tableCellToNode(
  cell: TableCell,
  align: Align,
  defs: Map<string, Definition>,
  isHeader: boolean,
): PMNode {
  const src = srcAttrsFromNode(cell);
  const type = isHeader ? "table_header" : "table_cell";
  return markdownSchema.node(type, { ...src, align }, phrasingToInline(cell.children, defs));
}

/**
 * Convert an array of mdast phrasing nodes into ProseMirror inline nodes.
 * Adjacent text nodes with identical marks are merged before returning.
 * @param nodes - Phrasing content children.
 * @param defs - Collected reference definitions.
 * @param active - Marks currently applied by ancestor inline wrappers.
 * @returns Array of ProseMirror inline nodes.
 */
function phrasingToInline(
  nodes: PhrasingContent[],
  defs: Map<string, Definition>,
  active: readonly Mark[] = [],
): PMNode[] {
  const out: PMNode[] = [];
  for (const node of nodes) {
    out.push(...phrasingNode(node, defs, active));
  }
  return mergeAdjacentText(out);
}

/**
 * Convert a single mdast phrasing node into one or more ProseMirror inline nodes.
 * @param node - An mdast phrasing-content node.
 * @param defs - Collected reference definitions.
 * @param active - Marks currently applied from ancestor wrappers.
 * @returns Array of ProseMirror inline nodes (can be empty for unknown types).
 */
function phrasingNode(
  node: PhrasingContent,
  defs: Map<string, Definition>,
  active: readonly Mark[],
): PMNode[] {
  switch (node.type) {
    case "text":
      return node.value ? [markdownSchema.text(node.value, Mark.setFrom(active))] : [];

    case "inlineCode":
      return [
        markdownSchema.text(
          node.value,
          Mark.setFrom([...active, markdownSchema.marks.code.create()]),
        ),
      ];

    case "break":
      return [markdownSchema.node("hard_break")];

    case "image":
      return [
        markdownSchema.node("image", {
          src: node.url,
          alt: node.alt ?? null,
          title: node.title ?? null,
        }),
      ];

    case "imageReference": {
      const def = defs.get(node.identifier.toLowerCase());
      return [
        markdownSchema.node("image", {
          src: def?.url ?? "",
          alt: node.alt ?? null,
          title: def?.title ?? null,
        }),
      ];
    }

    case "emphasis":
      return phrasingToInline(node.children, defs, [...active, markdownSchema.marks.em.create()]);

    case "strong":
      return phrasingToInline(node.children, defs, [
        ...active,
        markdownSchema.marks.strong.create(),
      ]);

    case "delete":
      return phrasingToInline(node.children, defs, [
        ...active,
        markdownSchema.marks.strikethrough.create(),
      ]);

    case "link":
      return phrasingToInline(node.children, defs, [
        ...active,
        markdownSchema.marks.link.create({
          href: node.url,
          title: node.title ?? null,
        }),
      ]);

    case "linkReference": {
      const def = defs.get(node.identifier.toLowerCase());
      return phrasingToInline(node.children, defs, [
        ...active,
        markdownSchema.marks.link.create({
          href: def?.url ?? "",
          title: def?.title ?? null,
        }),
      ]);
    }

    case "html":
      // Inline HTML is kept as plain text so that selection and anchors stay simple.
      return node.value ? [markdownSchema.text(node.value, Mark.setFrom(active))] : [];

    case "footnoteReference":
      return [markdownSchema.text(`[${node.identifier}]`, Mark.setFrom(active))];

    default:
      return [];
  }
}

/**
 * Merge consecutive text nodes that have identical mark sets into one node.
 * @param nodes - Array of ProseMirror inline nodes.
 * @returns A new array with adjacent same-mark text nodes combined.
 */
function mergeAdjacentText(nodes: PMNode[]): PMNode[] {
  if (nodes.length < 2) return nodes;
  const out: PMNode[] = [];
  for (const node of nodes) {
    const prev = out[out.length - 1];
    if (prev?.isText && node.isText && Mark.sameSet(prev.marks, node.marks)) {
      out[out.length - 1] = markdownSchema.text((prev.text ?? "") + (node.text ?? ""), prev.marks);
    } else {
      out.push(node);
    }
  }
  return out;
}
