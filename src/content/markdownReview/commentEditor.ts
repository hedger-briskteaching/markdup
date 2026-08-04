import {
  baseKeymap,
  setBlockType,
  toggleMark,
  wrapIn,
} from 'prosemirror-commands'
import { history, redo, undo } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import {
  liftListItem,
  sinkListItem,
  splitListItem,
  wrapInList,
} from 'prosemirror-schema-list'
import { EditorState, type Transaction } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { markdownSchema } from '../../markdown'
import { docFromMarkdown, docToMarkdown } from './markdownBody'

export type CommentEditorHandle = {
  getMarkdown: () => string
  setMarkdown: (markdown: string) => void
  focus: () => void
  destroy: () => void
  view: EditorView
}

export type MountCommentEditorOptions = {
  initialMarkdown?: string
  placeholder?: string
  /** Called when Mod-Enter is pressed. */
  onSubmit?: () => void
}

/**
 * Mount a compact ProseMirror WYSIWYG editor. Value is markdown on getMarkdown().
 */
export function mountCommentEditor(
  host: HTMLElement,
  options: MountCommentEditorOptions = {},
): CommentEditorHandle {
  host.replaceChildren()
  host.classList.add('rgm-comment-editor')

  const toolbar = document.createElement('div')
  toolbar.className = 'rgm-comment-editor-toolbar'
  toolbar.setAttribute('role', 'toolbar')
  toolbar.setAttribute('aria-label', 'Formatting')

  const surface = document.createElement('div')
  surface.className = 'rgm-comment-editor-surface'

  host.append(toolbar, surface)

  const doc = docFromMarkdown(options.initialMarkdown ?? '')
  const placeholder = options.placeholder ?? 'Leave a comment'

  const state = EditorState.create({
    doc,
    schema: markdownSchema,
    plugins: [
      history(),
      keymap({
        'Mod-z': undo,
        'Shift-Mod-z': redo,
        'Mod-y': redo,
        'Mod-b': toggleMark(markdownSchema.marks.strong!),
        'Mod-i': toggleMark(markdownSchema.marks.em!),
        'Mod-e': toggleMark(markdownSchema.marks.code!),
        'Mod-Enter': (_s, _d, view) => {
          options.onSubmit?.()
          return Boolean(view)
        },
        Enter: splitListItem(markdownSchema.nodes.list_item!),
        'Mod-[': liftListItem(markdownSchema.nodes.list_item!),
        'Mod-]': sinkListItem(markdownSchema.nodes.list_item!),
      }),
      keymap(baseKeymap),
    ],
  })

  const view = new EditorView(surface, {
    state,
    attributes: {
      class: 'rgm-comment-editor-content',
      'data-placeholder': placeholder,
    },
    dispatchTransaction(tr: Transaction) {
      const next = view.state.apply(tr)
      view.updateState(next)
      updatePlaceholder(view)
    },
  })

  buildToolbar(toolbar, view)
  updatePlaceholder(view)

  const handle: CommentEditorHandle = {
    getMarkdown: () => docToMarkdown(view.state.doc).trimEnd(),
    setMarkdown: (markdown: string) => {
      const next = docFromMarkdown(markdown)
      const tr = view.state.tr.replaceWith(
        0,
        view.state.doc.content.size,
        next.content,
      )
      view.dispatch(tr)
      updatePlaceholder(view)
    },
    focus: () => view.focus(),
    destroy: () => {
      view.destroy()
      editorsByHost.delete(host)
      host.replaceChildren()
      host.classList.remove('rgm-comment-editor')
    },
    view,
  }
  editorsByHost.set(host, handle)
  return handle
}

const editorsByHost = new WeakMap<HTMLElement, CommentEditorHandle>()

/** @internal Test helper. */
export function getCommentEditorForTest(
  host: HTMLElement,
): CommentEditorHandle | undefined {
  return editorsByHost.get(host)
}

function updatePlaceholder(view: EditorView): void {
  const empty =
    view.state.doc.childCount === 1 &&
    view.state.doc.firstChild?.type.name === 'paragraph' &&
    view.state.doc.firstChild.content.size === 0
  view.dom.classList.toggle('rgm-comment-editor-empty', empty)
}

function buildToolbar(toolbar: HTMLElement, view: EditorView): void {
  const btn = (
    label: string,
    title: string,
    run: () => void,
  ): HTMLButtonElement => {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'rgm-comment-editor-btn'
    el.textContent = label
    el.title = title
    el.setAttribute('aria-label', title)
    el.addEventListener('mousedown', (event) => {
      event.preventDefault()
      view.focus()
      run()
    })
    return el
  }

  const mark = (name: 'strong' | 'em' | 'code' | 'strikethrough') => {
    const type = markdownSchema.marks[name]!
    return () => toggleMark(type)(view.state, view.dispatch)
  }

  toolbar.append(
    btn('B', 'Bold', mark('strong')),
    btn('I', 'Italic', mark('em')),
    btn('<>', 'Code', mark('code')),
    btn('S', 'Strikethrough', mark('strikethrough')),
    btn('Link', 'Link', () => setLink(view)),
    btn('•', 'Bulleted list', () =>
      wrapInList(markdownSchema.nodes.bullet_list!)(view.state, view.dispatch),
    ),
    btn('1.', 'Numbered list', () =>
      wrapInList(markdownSchema.nodes.ordered_list!)(view.state, view.dispatch),
    ),
    btn('“', 'Quote', () =>
      wrapIn(markdownSchema.nodes.blockquote!)(view.state, view.dispatch),
    ),
    btn('{}', 'Code block', () =>
      setBlockType(markdownSchema.nodes.code_block!)(view.state, view.dispatch),
    ),
    btn('P', 'Paragraph', () =>
      setBlockType(markdownSchema.nodes.paragraph!)(view.state, view.dispatch),
    ),
  )
}

function setLink(view: EditorView): void {
  const type = markdownSchema.marks.link!
  const { from, to, empty } = view.state.selection
  if (empty) return
  const href = window.prompt('Link URL')
  if (href == null) return
  if (!href.trim()) {
    toggleMark(type)(view.state, view.dispatch)
    return
  }
  const tr = view.state.tr.addMark(from, to, type.create({ href: href.trim() }))
  view.dispatch(tr)
}
