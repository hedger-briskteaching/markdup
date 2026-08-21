import { baseKeymap, lift, setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import {
  InputRule,
  inputRules,
  textblockTypeInputRule,
  wrappingInputRule,
} from "prosemirror-inputrules";
import { keymap } from "prosemirror-keymap";
import type { MarkType, NodeType } from "prosemirror-model";
import { liftListItem, sinkListItem, splitListItem, wrapInList } from "prosemirror-schema-list";
import { EditorState, type Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { markdownSchema } from "../../markdown";
import { docFromMarkdown, docToMarkdown } from "./markdownBody";

export type CommentEditorHandle = {
  getMarkdown: () => string;
  setMarkdown: (markdown: string) => void;
  focus: () => void;
  destroy: () => void;
  view: EditorView;
};

export type MountCommentEditorOptions = {
  initialMarkdown?: string;
  placeholder?: string;
  /** Called when Mod-Enter is pressed. */
  onSubmit?: () => void;
};

/**
 * Mount a compact ProseMirror WYSIWYG editor into a host element.
 * Value is markdown via getMarkdown().
 * @param host - The container element to mount the editor into.
 * @param options - Initial content, placeholder, and submit callback.
 * @returns A handle to control the editor.
 */
export function mountCommentEditor(
  host: HTMLElement,
  options: MountCommentEditorOptions = {},
): CommentEditorHandle {
  host.replaceChildren();
  host.classList.add("rgm-comment-editor");

  const toolbar = document.createElement("div");
  toolbar.className = "rgm-comment-editor-toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "Formatting");

  const surface = document.createElement("div");
  surface.className = "rgm-comment-editor-surface";

  host.append(toolbar, surface);

  const doc = docFromMarkdown(options.initialMarkdown ?? "");
  const placeholder = options.placeholder ?? "Leave a comment";

  const state = EditorState.create({
    doc,
    schema: markdownSchema,
    plugins: [
      history(),
      buildInputRules(),
      keymap({
        "Mod-z": undo,
        "Shift-Mod-z": redo,
        "Mod-y": redo,
        "Mod-b": toggleMark(markdownSchema.marks.strong!),
        "Mod-e": toggleMark(markdownSchema.marks.code!),
        "Mod-Enter": (_s, _d, view) => {
          options.onSubmit?.();
          return Boolean(view);
        },
        Enter: splitListItem(markdownSchema.nodes.list_item!),
        "Mod-[": liftListItem(markdownSchema.nodes.list_item!),
        "Mod-]": sinkListItem(markdownSchema.nodes.list_item!),
      }),
      keymap(baseKeymap),
    ],
  });

  const view = new EditorView(surface, {
    state,
    attributes: {
      class: "rgm-comment-editor-content",
      "data-placeholder": placeholder,
    },
    dispatchTransaction(tr: Transaction) {
      const next = view.state.apply(tr);
      view.updateState(next);
      updatePlaceholder(view);
      updateToolbar(toolbar, view);
    },
  });

  buildToolbar(toolbar, view);
  updatePlaceholder(view);
  updateToolbar(toolbar, view);

  const handle: CommentEditorHandle = {
    getMarkdown: () => docToMarkdown(view.state.doc).trimEnd(),
    setMarkdown: (markdown: string) => {
      const next = docFromMarkdown(markdown);
      const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, next.content);
      view.dispatch(tr);
      updatePlaceholder(view);
      updateToolbar(toolbar, view);
    },
    focus: () => view.focus(),
    destroy: () => {
      view.destroy();
      editorsByHost.delete(host);
      host.replaceChildren();
      host.classList.remove("rgm-comment-editor");
    },
    view,
  };
  editorsByHost.set(host, handle);
  return handle;
}

const editorsByHost = new WeakMap<HTMLElement, CommentEditorHandle>();

/**
 * Retrieve the editor handle mounted on a host element.
 * @internal Test helper.
 * @param host - The host element.
 * @returns The editor handle, or undefined if none is mounted.
 */
export function getCommentEditorForTest(host: HTMLElement): CommentEditorHandle | undefined {
  return editorsByHost.get(host);
}

/**
 * Toggle the empty-state CSS class based on document content.
 * @param view - The ProseMirror EditorView.
 * @returns Nothing.
 */
function updatePlaceholder(view: EditorView): void {
  const empty =
    view.state.doc.childCount === 1 &&
    view.state.doc.firstChild?.type.name === "paragraph" &&
    view.state.doc.firstChild.content.size === 0;
  view.dom.classList.toggle("rgm-comment-editor-empty", empty);
}

/**
 * Build the ProseMirror input rules for markdown shortcuts.
 * @returns The input rules plugin.
 */
function buildInputRules() {
  const strong = markdownSchema.marks.strong!;
  const code = markdownSchema.marks.code!;
  const bullet = markdownSchema.nodes.bullet_list!;
  const ordered = markdownSchema.nodes.ordered_list!;
  const quote = markdownSchema.nodes.blockquote!;
  const codeBlock = markdownSchema.nodes.code_block!;

  return inputRules({
    rules: [
      markInputRule(/`([^`]+)`$/, code),
      markInputRule(/\*\*([^*]+)\*\*$/, strong),
      markInputRule(/__([^_]+)__$/, strong),
      wrappingInputRule(/^\s*([-+*])\s$/, bullet),
      wrappingInputRule(
        /^(\d+)\.\s$/,
        ordered,
        (match) => ({ order: Number(match[1]) }),
        (match, node) => node.childCount + (node.attrs.order as number) === Number(match[1]),
      ),
      wrappingInputRule(/^\s*>\s$/, quote),
      textblockTypeInputRule(/^```$/, codeBlock),
    ],
  });
}

/**
 * Apply a mark to the captured group when the closing delimiter is typed.
 * @param regexp - Pattern that matches the delimited text.
 * @param markType - The ProseMirror mark type to apply.
 * @returns An InputRule instance.
 */
function markInputRule(regexp: RegExp, markType: MarkType): InputRule {
  return new InputRule(regexp, (state, match, start, end) => {
    const text = match[1];
    if (!text) return null;

    const full = match[0]!;
    const textOffset = full.indexOf(text);
    if (textOffset < 0) return null;
    const textStart = start + textOffset;
    const textEnd = textStart + text.length;

    const tr = state.tr;
    if (textEnd < end) tr.delete(textEnd, end);
    if (textStart > start) tr.delete(start, textStart);
    tr.addMark(start, start + text.length, markType.create());
    tr.removeStoredMark(markType);
    return tr;
  });
}

/**
 * Determine if the selection is inside a parent of the given node type.
 * @param state - The current editor state.
 * @param type - The node type to look for.
 * @returns True when such a parent exists.
 */
function parentHasType(state: EditorState, type: NodeType): boolean {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type === type) {
      return true;
    }
  }
  return false;
}

type BlockKind = "bullet" | "ordered" | "quote" | "code";

/**
 * Apply a block style to the current selection.
 * The same tool again exits to a paragraph. A different tool switches.
 * @param view - The ProseMirror EditorView.
 * @param kind - The block kind to apply.
 * @returns Nothing.
 */
function applyBlock(view: EditorView, kind: BlockKind): void {
  const bullet = markdownSchema.nodes.bullet_list!;
  const ordered = markdownSchema.nodes.ordered_list!;
  const quote = markdownSchema.nodes.blockquote!;
  const codeBlock = markdownSchema.nodes.code_block!;
  const paragraph = markdownSchema.nodes.paragraph!;
  const listItem = markdownSchema.nodes.list_item!;

  const { state } = view;
  const inBullet = parentHasType(state, bullet);
  const inOrdered = parentHasType(state, ordered);
  const inQuote = parentHasType(state, quote);
  const inCode = state.selection.$from.parent.type === codeBlock;

  if (kind === "bullet" && inBullet) {
    liftListItem(listItem)(view.state, view.dispatch);
    return;
  }
  if (kind === "ordered" && inOrdered) {
    liftListItem(listItem)(view.state, view.dispatch);
    return;
  }
  if (kind === "quote" && inQuote) {
    lift(view.state, view.dispatch);
    return;
  }
  if (kind === "code" && inCode) {
    setBlockType(paragraph)(view.state, view.dispatch);
    return;
  }

  // Leave the current wrapper, then apply the new one.
  for (let i = 0; i < 8; i++) {
    const s = view.state;
    if (s.selection.$from.parent.type === codeBlock) {
      setBlockType(paragraph)(s, view.dispatch);
      continue;
    }
    if (parentHasType(s, quote)) {
      lift(s, view.dispatch);
      continue;
    }
    if (parentHasType(s, bullet) || parentHasType(s, ordered)) {
      liftListItem(listItem)(s, view.dispatch);
      continue;
    }
    break;
  }

  if (kind === "bullet") {
    wrapInList(bullet)(view.state, view.dispatch);
  } else if (kind === "ordered") {
    wrapInList(ordered)(view.state, view.dispatch);
  } else if (kind === "quote") {
    wrapIn(quote)(view.state, view.dispatch);
  } else {
    setBlockType(codeBlock)(view.state, view.dispatch);
  }
}

/**
 * Determine if the entire selection carries a given mark.
 * @param state - The current editor state.
 * @param type - The mark type to test.
 * @returns True when the mark fully covers the selection.
 */
function selectionFullyHasMark(state: EditorState, type: MarkType): boolean {
  const { from, to, empty, $from } = state.selection;
  if (empty) {
    return Boolean(type.isInSet(state.storedMarks || $from.marks()));
  }

  let sawText = false;
  let missing = false;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || missing) return;
    const start = Math.max(pos, from);
    const end = Math.min(pos + node.nodeSize, to);
    if (start >= end) return;
    sawText = true;
    if (!type.isInSet(node.marks)) missing = true;
  });
  return sawText && !missing;
}

/**
 * Sync toolbar button active states with current marks in the editor.
 * @param toolbar - The toolbar container element.
 * @param view - The ProseMirror EditorView.
 * @returns Nothing.
 */
function updateToolbar(toolbar: HTMLElement, view: EditorView): void {
  for (const button of toolbar.querySelectorAll<HTMLButtonElement>(
    ".rgm-comment-editor-btn[data-mark]",
  )) {
    const markName = button.getAttribute("data-mark");
    const type = markName ? markdownSchema.marks[markName] : undefined;
    const active = Boolean(type && selectionFullyHasMark(view.state, type));
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }
}

/**
 * Build the formatting toolbar buttons for the editor.
 * @param toolbar - The toolbar container element.
 * @param view - The ProseMirror EditorView.
 * @returns Nothing.
 */
function buildToolbar(toolbar: HTMLElement, view: EditorView): void {
  const btn = (
    label: string,
    tooltip: string,
    run: () => void,
    markName?: "strong" | "code",
  ): HTMLButtonElement => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "rgm-comment-editor-btn";
    el.textContent = label;
    el.setAttribute("data-tooltip", tooltip);
    el.setAttribute("aria-label", tooltip);
    if (markName) {
      el.setAttribute("data-mark", markName);
      el.setAttribute("aria-pressed", "false");
    }
    el.addEventListener("mousedown", (event) => {
      event.preventDefault();
      view.focus();
      run();
    });
    return el;
  };

  /**
   * Build a toolbar action that toggles a mark type on the selection.
   * @param name - Mark name (`strong` or `code`).
   * @returns A function that runs the toggle on the editor view.
   */
  const mark = (name: "strong" | "code") => {
    const type = markdownSchema.marks[name]!;
    return () => toggleMark(type)(view.state, view.dispatch);
  };

  toolbar.append(
    btn("B", "Bold (⌘B)", mark("strong"), "strong"),
    btn("<>", "Inline code (⌘E)", mark("code"), "code"),
    btn("•", "Bulleted list", () => applyBlock(view, "bullet")),
    btn("1.", "Numbered list", () => applyBlock(view, "ordered")),
    btn('"', "Block quote", () => applyBlock(view, "quote")),
    btn("{}", "Code block", () => applyBlock(view, "code")),
  );
}
