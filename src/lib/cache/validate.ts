// Small runtime checks for what is read back from the local cache. Whatever is
// on disk is untrusted: it may come from an older build, be truncated, or be
// edited by hand, and a task or note missing a field would crash the component
// that renders it. So every entity is checked against a field spec before it
// is used, and anything that doesn't match is treated as "not cached".
//
// A spec maps field -> kind. `?` allows the field to be absent, `|null` allows
// null, and an array of strings is an enum.

type Kind =
  'string' | 'number' | 'boolean' | 'object' | 'array' | readonly string[]

export type Field = { kind: Kind; optional?: boolean; nullable?: boolean }

export const field = {
  string: { kind: 'string' } as Field,
  number: { kind: 'number' } as Field,
  boolean: { kind: 'boolean' } as Field,
  object: { kind: 'object' } as Field,
  array: { kind: 'array' } as Field,
  nullableString: { kind: 'string', nullable: true } as Field,
  nullableNumber: { kind: 'number', nullable: true } as Field,
  optionalString: { kind: 'string', optional: true } as Field,
  optionalNumber: { kind: 'number', optional: true } as Field,
  oneOf: (...values: string[]): Field => ({ kind: values }),
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function matches(value: unknown, spec: Field): boolean {
  if (value === undefined) return spec.optional === true
  if (value === null) return spec.nullable === true
  if (Array.isArray(spec.kind)) return spec.kind.includes(value as string)
  switch (spec.kind) {
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'object':
      return isRecord(value)
    case 'array':
      return Array.isArray(value)
    default:
      return false
  }
}

export function isShape<T>(spec: Record<string, Field>) {
  return (value: unknown): value is T =>
    isRecord(value) &&
    Object.entries(spec).every(([name, kind]) => matches(value[name], kind))
}

export function isArrayOf<T>(guard: (value: unknown) => value is T) {
  return (value: unknown): value is T[] =>
    Array.isArray(value) && value.every(guard)
}
