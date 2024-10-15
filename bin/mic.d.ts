declare module 'mic' {
  import type { Transform } from 'node:stream'

  export function mic(options: Options): Mic

  export interface Mic {
    start(): void
    stop(): void
    pause(): void
    resume(): void
    getAudioStream(): Transform
  }

  export interface Options {
    endian?: 'big' | 'little'
    bitwidth?: number | string
    encoding?: 'signed-integer' | 'unsigned-integer'
    rate?: number | string
    channels?: number | string
    device?: string
    exitOnSilence?: number | string
    debug?: boolean | string
    fileType?: string
  }

  export = mic
}
