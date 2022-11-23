import { cheerio } from '../deps.ts'
import temmeParser, {
  ExpandedTemmeSelector,
  NormalSelector,
  ParentRefSelector,
  SnippetDefine,
  TemmeSelector,
} from '../parser/mod.ts'
import invariant from './invariant.ts'

import { defaultFilterDict, FilterFn } from './filters.ts'
import { defaultProcedureDict, ProcedureFn } from './procedures.ts'
import { defaultModifierDict, ModifierFn } from './modifiers.ts'
import { msg } from './check.ts'
import { CaptureResult } from './CaptureResult.ts'
import {
  isAttributeQualifier,
  isCapture,
  isCheerioStatic,
  last,
  makeNormalCssSelector,
} from './utils.ts'

export interface TemmeParser {
  parse(temmeSelectorString: string): TemmeSelector[]
}

export function temme(
  html: string | cheerio.CheerioAPI | cheerio.Element,
  selector: string | TemmeSelector[],
  extraFilters: Record<string, FilterFn> = {},
  extraModifiers: Record<string, ModifierFn> = {},
  extraProcedures: Record<string, ProcedureFn> = {},
) {
  let $: cheerio.CheerioAPI
  if (typeof html === 'string') {
    $ = cheerio.load(html, { decodeEntities: false })
  } else if (isCheerioStatic(html)) {
    $ = html
  } else {
    $ = cheerio.load(html)
  }

  let rootSelectorArray: TemmeSelector[]
  if (typeof selector === 'string') {
    rootSelectorArray = temmeParser.parse(selector)
  } else {
    rootSelectorArray = selector
  }
  if (rootSelectorArray.length === 0) {
    return null
  }

  const filterDict: Record<string, FilterFn> = Object.assign(
    {},
    defaultFilterDict,
    extraFilters,
  )
  const modifierDict: Record<string, ModifierFn> = Object.assign(
    {},
    defaultModifierDict,
    extraModifiers,
  )
  const procedureDict: Record<string, ProcedureFn> = Object.assign(
    {},
    defaultProcedureDict,
    extraProcedures,
  )
  const snippetsMap = new Map<string, SnippetDefine>()

  function helper(
    cntCheerio: cheerio.Cheerio<any>,
    selectorArray: TemmeSelector[],
  ): CaptureResult {
    const result = new CaptureResult(filterDict, modifierDict)

    // First pass: process SnippetDefine / FilterDefine / ModifierDefine / ProcedureDefine
    for (const selector of selectorArray) {
      if (selector.type === 'snippet-define') {
        invariant(
          !snippetsMap.has(selector.name),
          msg.snippetAlreadyDefined(selector.name),
        )
        snippetsMap.set(selector.name, selector)
      } else if (selector.type === 'filter-define') {
        const { name, argsPart, code } = selector
        invariant(!(name in filterDict), msg.filterAlreadyDefined(name))
        const funcString = `(function (${argsPart}) { ${code} })`
        filterDict[name] = eval(funcString)
      } else if (selector.type === 'modifier-define') {
        const { name, argsPart, code } = selector
        invariant(!(name in modifierDict), msg.modifierAlreadyDefined(name))
        const funcString = `(function (${argsPart}) { ${code} })`
        modifierDict[name] = eval(funcString)
      } else if (selector.type === 'procedure-define') {
        const { name, argsPart, code } = selector
        invariant(!(name in procedureDict), msg.procedureAlreadyDefined(name))
        const funcString = `(function (${argsPart}) { ${code} })`
        procedureDict[name] = eval(funcString)
      }
    }

    // Second pass: process match and capture
    for (const selector of expandSnippets(selectorArray)) {
      if (selector.type === 'normal-selector') {
        const cssSelector = makeNormalCssSelector(selector.sections)
        const subCheerio = cntCheerio.find(cssSelector)
        if (subCheerio.length > 0) {
          // Only the first element will be captured.
          capture(result, subCheerio.first(), selector)
        }
        if (selector.arrayCapture) {
          result.add(
            selector.arrayCapture,
            subCheerio
              .toArray()
              .map(sub => helper($(sub), selector.children).getResult()),
          )
        }
      } else if (selector.type === 'parent-ref-selector') {
        const cssSelector = makeNormalCssSelector([selector.section])
        if (cntCheerio.is(cssSelector)) {
          capture(result, cntCheerio, selector)
        }
      } else if (selector.type === 'assignment') {
        result.forceAdd(selector.capture, selector.value)
      } // else selector.type is 'xxx-define'. Do nothing.
    }
    return result
  }

  /** Expand snippets recursively.
   * The returned selector array will not contain any `SnippetExpand`.
   * `expanded` is used to detect circular expansion. */
  function expandSnippets(
    selectorArray: TemmeSelector[],
    expanded: string[] = [],
  ): ExpandedTemmeSelector[] {
    const result: ExpandedTemmeSelector[] = []
    for (const selector of selectorArray) {
      if (selector.type === 'snippet-expand') {
        invariant(
          snippetsMap.has(selector.name),
          msg.snippetNotDefined(selector.name),
        )
        const snippet = snippetsMap.get(selector.name)!
        const nextExpanded = expanded.concat(snippet.name)
        invariant(
          !expanded.includes(snippet.name),
          msg.circularSnippetExpansion(nextExpanded),
        )
        const slice = expandSnippets(snippet.selectors, nextExpanded)
        result.push(...slice)
      } else {
        result.push(selector)
      }
    }
    return result
  }

  /** Capture the node according to the selector. */
  function capture(
    result: CaptureResult,
    node: cheerio.Cheerio<any>,
    selector: NormalSelector | ParentRefSelector,
  ) {
    const section =
      selector.type === 'normal-selector'
        ? last(selector.sections)
        : selector.section

    for (const qualifier of section.qualifiers.filter(isAttributeQualifier)) {
      if (isCapture(qualifier.value)) {
        const { attribute, value: capture } = qualifier
        const attributeValue = node.attr(attribute)
        if (attributeValue !== undefined) {
          // capture only when attribute exists
          result.add(capture, attributeValue)
        }
      }
    }

    if (selector.procedure != null) {
      const { name, args } = selector.procedure
      const fn = procedureDict[name]
      invariant(typeof fn === 'function', msg.invalidProcedure(name))
      fn(result, node, ...args)
    }
  }

  return helper($.root(), rootSelectorArray).getResult()
}
