// deno-lint-ignore-file no-explicit-any
import { cheerio } from '../deps.ts'
import { Capture, Literal } from '../parser/mod.ts'

import invariant from './invariant.ts'

import { CaptureResult } from './CaptureResult.ts'
import { ASSIGN_PROCEDURE_NAME, DEFAULT_PROCEDURE_NAME } from './constants.ts'
import { isCapture } from './utils.ts'

export interface ProcedureFn {
  (result: CaptureResult, node: any, ...args: any[]): void
}

function text(result: CaptureResult, node: any, capture: Capture) {
  result.add(capture, node.text())
}

function html(result: CaptureResult, node: any, capture: Capture) {
  result.add(capture, node.html())
}

function node(result: CaptureResult, node: any, capture: Capture) {
  result.add(capture, cheerio.load(node))
}

/** Try to capture text within a node's text.
 * This content function can have three forms:
 * 1. find('before-string', $capture)   Try to capture the text after 'before-string'
 * 2. find($capture, 'after-string')    Try to capture the text before 'after-string'
 * 3. find('pre', $capture, 'post')     Try to capture the text between 'pre' and 'post'
 * */
function find(result: CaptureResult, node: cheerio.CheerioAPI, ...args: (string | Capture)[]) {
  const invalidArgs = 'Invalid arguments received by match(...)'
  const s = node.text()
  if (args.length === 2) {
    const [before, after] = args
    invariant(
      (typeof before === 'string' && isCapture(after)) ||
        (isCapture(before) && typeof after === 'string'),
      invalidArgs,
    )
    if (typeof before === 'string') {
      const capture = after as Capture
      const i = s.indexOf(before)
      if (i === -1) {
        return
      }
      result.add(capture, s.substring(i + before.length))
    } else {
      const capture = before as Capture
      const i = s.indexOf(after as string)
      if (i === -1) {
        return
      }
      result.add(capture, s.substring(0, i))
    }
  } else {
    invariant(args.length === 3, invalidArgs)
    const [before, capture, after] = args as [string, Capture, string]
    invariant(
      typeof before === 'string' && isCapture(capture) && typeof after === 'string',
      invalidArgs,
    )
    const i = s.indexOf(before)
    if (i === -1) {
      return
    }
    const j = s.indexOf(after, i + before.length)
    if (j === -1) {
      return
    }
    result.add(capture, s.substring(i + before.length, j))
  }
}

function assign(result: CaptureResult, _: any, capture: Capture, value: Literal) {
  result.forceAdd(capture, value)
}

export const defaultProcedureDict: Record<string, ProcedureFn> = {
  [DEFAULT_PROCEDURE_NAME]: text,
  [ASSIGN_PROCEDURE_NAME]: assign,
  html,
  node,
  find,
}

export function defineProcedure(name: string, fn: ProcedureFn) {
  defaultProcedureDict[name] = fn
}
