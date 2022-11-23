// copy npm:invariant

export class InvariantViolation extends Error {
  framesToPop = 1
}

function invariant(testValue: false, format: string, ...extra: unknown[]): never
function invariant(
  testValue: unknown,
  format: string,
  ...extra: unknown[]
): asserts testValue

function invariant(condition: unknown, format: string, ...args: unknown[]) {
  if (!condition) {
    let argIndex = 0
    throw new InvariantViolation(
      format.replace(/%s/g, function () {
        return String(args[argIndex++])
      }),
    )
  }
}

export default invariant
