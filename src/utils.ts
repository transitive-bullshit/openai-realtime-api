import { customAlphabet } from 'nanoid'

export const isBrowser = !!(globalThis as any).document

export function hasNativeWebSocket(): boolean {
  return !!globalThis.WebSocket
}

export function getEnv(name: string): string | undefined {
  try {
    return typeof process !== 'undefined'
      ? // eslint-disable-next-line no-process-env
        process.env?.[name]
      : undefined
  } catch {
    return undefined
  }
}

function assertImpl(value: unknown, message?: string | Error): asserts value {
  if (value) {
    return
  }

  if (!message) {
    throw new Error('Assertion failed')
  }

  throw typeof message === 'string' ? new Error(message) : message
}

/**
 * Assertion function that defaults to Node.js's `assert` module if it's
 * available, with a basic backup if not.
 */
let assert: (value: unknown, message?: string | Error) => asserts value =
  assertImpl

try {
  // Default to the Node.js assert module if it's available
  const assertImport = await import('node:assert')
  if (assertImport?.default) {
    assert = assertImport.default
  }
} catch {}

export { assert }

/**
 * Converts Float32Array of amplitude data to ArrayBuffer in Int16Array format.
 */
export function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2)
  const view = new DataView(buffer)
  let offset = 0

  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Array[i]!))
    view.setInt16(offset, s < 0 ? s * 0x80_00 : s * 0x7f_ff, true)
  }

  return buffer
}

/**
 * Converts a base64 string to an ArrayBuffer.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)

  for (let i = 0; i < len; i++) {
    // eslint-disable-next-line unicorn/prefer-code-point
    bytes[i] = binaryString.charCodeAt(i)
  }

  return bytes.buffer
}

/**
 * Converts an ArrayBuffer, Int16Array or Float32Array to a base64 string.
 */
export function arrayBufferToBase64(
  arrayBuffer: ArrayBuffer | Int16Array | Float32Array
): string {
  if (arrayBuffer instanceof Float32Array) {
    arrayBuffer = floatTo16BitPCM(arrayBuffer)
  } else if (arrayBuffer instanceof Int16Array) {
    arrayBuffer = arrayBuffer.buffer
  }

  const bytes = new Uint8Array(arrayBuffer)
  const chunkSize = 0x80_00 // 32KB chunk size
  let binary = ''

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, chunk as any)
  }

  return btoa(binary)
}

/**
 * Merge two Int16Arrays from Int16Arrays or ArrayBuffers.
 */
export function mergeInt16Arrays(
  left: ArrayBuffer | Int16Array,
  right: ArrayBuffer | Int16Array
): Int16Array {
  if (left instanceof ArrayBuffer) {
    left = new Int16Array(left)
  }

  if (right instanceof ArrayBuffer) {
    right = new Int16Array(right)
  }

  if (!(left instanceof Int16Array) || !(right instanceof Int16Array)) {
    throw new TypeError(`Both items must be Int16Array`)
  }

  const newValues = new Int16Array(left.length + right.length)
  for (const [i, element] of left.entries()) {
    newValues[i] = element
  }

  for (const [j, element] of right.entries()) {
    newValues[left.length + j] = element
  }

  return newValues
}

// base58; non-repeating chars
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const generateIdImpl = customAlphabet(alphabet, 21)

/**
 * Generates an id to send with events and messages.
 */
export function generateId(prefix: string, size = 21): string {
  const id = generateIdImpl(size)
  return `${prefix}${id}`
}

export const sleep = (t: number) =>
  new Promise<void>((r) => setTimeout(() => r(), t))

export function trimDebugEvent(
  event?: any,
  {
    maxLimit = 200
  }: {
    maxLimit?: number
  } = {}
): any {
  if (!event) return event

  const e = structuredClone(event)

  if (e.item?.content?.find((c: any) => c.audio)) {
    e.item.content = e.item.content.map(({ audio, c }: any) => {
      if (audio) {
        return {
          ...c,
          audio: '<base64 redacted...>'
        }
      } else {
        return c
      }
    })
  }

  if (e.audio?.length > maxLimit) {
    e.audio = '<base64 redacted...>'
  }

  if (e.delta?.length > maxLimit) {
    e.delta = e.delta.slice(0, maxLimit) + '... (truncated)'
  }

  return e
}
