import type { Node as PMNode } from 'prosemirror-model'
import { markdownToDoc } from './index'

export type BlockView = {
  type: string
  srcFrom: number | null
  srcTo: number | null
  node: PMNode
  normText: string
}

export type RowModel = {
  id: string
  changed: boolean
  old?: BlockView
  new?: BlockView
}

type AlignOp =
  | { kind: 'equal'; old: BlockView; new: BlockView }
  | { kind: 'delete'; old: BlockView }
  | { kind: 'insert'; new: BlockView }

/**
 * Align two Markdown strings into Before/After block rows.
 */
export function alignMarkdown(oldSource: string, newSource: string): RowModel[] {
  const oldDoc = markdownToDoc(oldSource || '')
  const newDoc = markdownToDoc(newSource || '')
  return alignDocs(oldDoc, newDoc)
}

/**
 * Align two ProseMirror docs (top-level blocks) into row models.
 */
export function alignDocs(oldDoc: PMNode, newDoc: PMNode): RowModel[] {
  const oldBlocks = extractBlocks(oldDoc)
  const newBlocks = extractBlocks(newDoc)
  const ops = lcsOps(oldBlocks, newBlocks)
  const collapsed = collapseChanged(ops)
  return collapsed.map((op, index) => opToRow(op, index))
}

export function extractBlocks(doc: PMNode): BlockView[] {
  const blocks: BlockView[] = []
  doc.forEach((node) => {
    blocks.push({
      type: node.type.name,
      srcFrom: (node.attrs.srcFrom as number | null) ?? null,
      srcTo: (node.attrs.srcTo as number | null) ?? null,
      node,
      normText: normalizeBlockText(node),
    })
  })
  return blocks
}

export function normalizeBlockText(node: PMNode): string {
  if (node.type.name === 'front_matter') {
    return normalizeText(String(node.attrs.value ?? ''))
  }
  if (node.type.name === 'html_block') {
    return normalizeText(String(node.attrs.html ?? ''))
  }
  if (node.type.name === 'horizontal_rule') {
    return '---'
  }
  return normalizeText(node.textContent)
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function blocksMatch(a: BlockView, b: BlockView): boolean {
  return a.type === b.type && a.normText === b.normText
}

/** Classic LCS over identical blocks (type + normalized text). */
function lcsOps(oldBlocks: BlockView[], newBlocks: BlockView[]): AlignOp[] {
  const n = oldBlocks.length
  const m = newBlocks.length
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => 0),
  )

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (blocksMatch(oldBlocks[i]!, newBlocks[j]!)) {
        dp[i]![j] = dp[i + 1]![j + 1]! + 1
      } else {
        dp[i]![j] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
      }
    }
  }

  const ops: AlignOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (blocksMatch(oldBlocks[i]!, newBlocks[j]!)) {
      ops.push({ kind: 'equal', old: oldBlocks[i]!, new: newBlocks[j]! })
      i++
      j++
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      ops.push({ kind: 'delete', old: oldBlocks[i]! })
      i++
    } else {
      ops.push({ kind: 'insert', new: newBlocks[j]! })
      j++
    }
  }
  while (i < n) {
    ops.push({ kind: 'delete', old: oldBlocks[i]! })
    i++
  }
  while (j < m) {
    ops.push({ kind: 'insert', new: newBlocks[j]! })
    j++
  }
  return ops
}

type CollapsedOp =
  | { kind: 'equal'; old: BlockView; new: BlockView }
  | { kind: 'change'; old: BlockView; new: BlockView }
  | { kind: 'delete'; old: BlockView }
  | { kind: 'insert'; new: BlockView }

/**
 * Pair a deletion and the next same-type insertion into one changed row.
 */
function collapseChanged(ops: AlignOp[]): CollapsedOp[] {
  const out: CollapsedOp[] = []
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]!
    if (op.kind === 'equal') {
      out.push(op)
      continue
    }
    if (op.kind === 'delete') {
      const next = ops[i + 1]
      if (next?.kind === 'insert' && next.new.type === op.old.type) {
        out.push({ kind: 'change', old: op.old, new: next.new })
        i++
        continue
      }
      out.push(op)
      continue
    }
    out.push(op)
  }
  return out
}

function opToRow(op: CollapsedOp, index: number): RowModel {
  switch (op.kind) {
    case 'equal':
      return {
        id: `row-${index}`,
        changed: false,
        old: op.old,
        new: op.new,
      }
    case 'change':
      return {
        id: `row-${index}`,
        changed: true,
        old: op.old,
        new: op.new,
      }
    case 'delete':
      return {
        id: `row-${index}`,
        changed: true,
        old: op.old,
      }
    case 'insert':
      return {
        id: `row-${index}`,
        changed: true,
        new: op.new,
      }
  }
}
