import * as validators from './validators.js'
export type SchemaName = keyof typeof validators
export function validateProtocol(name: SchemaName, value: unknown): boolean {
  return validators[name](value)
}
export function assertProtocol(name: SchemaName, value: unknown): void {
  if (!validateProtocol(name, value)) throw new Error(`Invalid ${name}`)
}
