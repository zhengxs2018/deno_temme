// deno-lint-ignore-file no-prototype-builtins no-explicit-any
import type { Capture, Filter, Modifier } from '../parser/mod.ts'

import { msg } from './check.ts'
import { DEFAULT_CAPTURE_KEY } from './constants.ts'
import { FilterFn } from './filters.ts'
import { ModifierFn } from './modifiers.ts'
import invariant from './invariant.ts'
import { isEmptyObject } from './utils.ts'

const addModifier: Modifier = { name: 'add', args: [] }
const forceAddModifier: Modifier = { name: 'forceAdd', args: [] }

export class CaptureResult {
  private readonly result: any = {}

  constructor(
    readonly filterDict: Record<string, FilterFn>,
    readonly modifierDict: Record<string, ModifierFn>,
  ) {}

  get(key: string) {
    return this.result[key]
  }

  set(key: string, value: any) {
    this.result[key] = value
  }

  add(capture: Capture, value: any) {
    this.exec(capture, value, addModifier)
  }

  forceAdd(capture: Capture, value: any) {
    this.exec(capture, value, forceAddModifier)
  }

  private exec(capture: Capture, value: any, defaultModifier: Modifier) {
    const modifier = capture.modifier || defaultModifier
    const modifierFn = this.modifierDict[modifier.name]

    invariant(
      typeof modifierFn === 'function',
      msg.invalidModifier(modifier.name),
    )

    modifierFn(
      this,
      capture.name,
      this.applyFilterList(value, capture.filterList),
      ...modifier.args,
    )
  }

  getResult() {
    let returnVal = this.result
    if (returnVal.hasOwnProperty(DEFAULT_CAPTURE_KEY)) {
      returnVal = this.result[DEFAULT_CAPTURE_KEY]
    }
    if (isEmptyObject(returnVal)) {
      returnVal = null
    }
    return returnVal
  }

  private applyFilter(value: any, filter: Filter) {
    const filterFn: FilterFn =
      this.filterDict[filter.name] || value[filter.name]
    invariant(typeof filterFn === 'function', msg.invalidFilter(filter.name))
    return filterFn.apply(value, filter.args)
  }

  private applyFilterList(initValue: any, filterList: Filter[]) {
    return filterList.reduce((value, filter) => {
      if (filter.isArrayFilter) {
        invariant(
          Array.isArray(value),
          msg.arrayFilterAppliedToNonArrayValue(filter.name),
        )
        return value.map((item: any) => this.applyFilter(item, filter))
      } else {
        return this.applyFilter(value, filter)
      }
    }, initValue)
  }
}
