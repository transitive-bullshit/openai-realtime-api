import type { ClientRequest } from 'node:http'

import type { WebSocket as WS } from 'ws'

import type { RealtimeClientEvents, RealtimeServerEvents } from './events'
import { RealtimeEventHandler } from './event-handler'
import {
  generateId,
  getEnv,
  hasNativeWebSocket,
  isBrowser,
  trimDebugEvent
} from './utils'

/**
 * The RealtimeAPI class handles low-level communication with the OpenAI
 * Realtime API via WebSockets.
 */
export class RealtimeAPI extends RealtimeEventHandler {
  readonly model: string
  readonly url: string
  readonly apiKey?: string
  readonly debug: boolean
  ws?: WebSocket | WS

  /**
   * Creates a new RealtimeAPI instance.
   */
  constructor({
    model = 'gpt-4o-realtime-preview-2024-10-01',
    url = 'wss://api.openai.com/v1/realtime',
    apiKey = getEnv('OPENAI_API_KEY'),
    dangerouslyAllowAPIKeyInBrowser,
    debug
  }: {
    model?: string
    url?: string
    apiKey?: string
    dangerouslyAllowAPIKeyInBrowser?: boolean
    debug?: boolean
  } = {}) {
    super()

    this.model = model
    this.url = url
    this.apiKey = apiKey
    this.debug = !!debug

    if (isBrowser && this.apiKey) {
      if (!dangerouslyAllowAPIKeyInBrowser) {
        throw new Error(
          'Unable to provide API key in the browser without "dangerouslyAllowAPIKeyInBrowser" set to true'
        )
      }
    }
  }

  /**
   * Whether or not the WebSocket is connected.
   */
  get isConnected(): boolean {
    return !!this.ws
  }

  /**
   * Connects to Realtime API WebSocket Server.
   */
  async connect() {
    if (this.isConnected) {
      return
    }

    if (!this.apiKey) {
      console.warn(`No apiKey provided for connection to "${this.url}"`)
    }

    const url = new URL(this.url)
    url.searchParams.set('model', this.model)

    if (hasNativeWebSocket()) {
      if (isBrowser && this.apiKey) {
        console.warn(
          'Warning: Connecting using API key in the browser, this is not recommended'
        )
      }

      const ws = new WebSocket(
        url.toString(),
        [
          'realtime',
          this.apiKey ? `openai-insecure-api-key.${this.apiKey}` : undefined,
          'openai-beta.realtime-v1'
        ].filter(Boolean)
      )

      ws.addEventListener('message', (event) => {
        const message: any = JSON.parse(event.data)
        this.receive(message.type, message)
      })

      return new Promise((resolve, reject) => {
        const connectionErrorHandler = () => {
          this.disconnect(ws)
          reject(new Error(`Could not connect to "${this.url}"`))
        }

        ws.addEventListener('error', connectionErrorHandler)
        ws.addEventListener('open', () => {
          this._log(`Connected to "${this.url}"`)

          ws.removeEventListener('error', connectionErrorHandler)
          ws.addEventListener('error', () => {
            this.disconnect(ws)
            this._log(`Error, disconnected from "${this.url}"`)
            this.dispatch('close', { error: true })
          })

          ws.addEventListener('close', () => {
            this.disconnect(ws)
            this._log(`Disconnected from "${this.url}"`)
            this.dispatch('close', { error: false })
          })

          this.ws = ws
          resolve(true)
        })
      })
    } else {
      // Node.js
      const wsModule = await import('ws')
      const ws: WS = new wsModule.WebSocket(url.toString(), [], {
        // Add auth headers
        finishRequest: (request: ClientRequest) => {
          request.setHeader('OpenAI-Beta', 'realtime=v1')

          if (this.apiKey) {
            request.setHeader('Authorization', `Bearer ${this.apiKey}`)

            // Needed for Azure OpenAI
            request.setHeader('api-key', this.apiKey)
          }

          request.end()
        }
        // TODO: this `any` is a workaround for `@types/ws` being out-of-date.
      } as any)

      ws.on('message', (data) => {
        const message: any = JSON.parse(data.toString())
        this.receive(message.type, message)
      })

      return new Promise<void>((resolve, reject) => {
        const connectionErrorHandler = () => {
          this.disconnect(ws)
          reject(new Error(`Could not connect to "${this.url}"`))
        }

        ws.on('error', connectionErrorHandler)
        ws.on('open', () => {
          this._log(`Connected to "${this.url}"`)

          ws.removeListener('error', connectionErrorHandler)
          ws.on('error', () => {
            this._log(`Error, disconnected from "${this.url}"`)
            this.disconnect(ws)
            this.dispatch('close', { error: true })
          })

          ws.on('close', () => {
            this.disconnect(ws)
            this._log(`Disconnected from "${this.url}"`)
            this.dispatch('close', { error: false })
          })

          this.ws = ws
          resolve()
        })
      })
    }
  }

  /**
   * Disconnects from the Realtime API server.
   */
  disconnect(ws?: WebSocket | WS) {
    if (this.ws && (!ws || this.ws === ws)) {
      this.ws?.close()
      this.ws = undefined
    }
  }

  /**
   * Receives an event from WebSocket and dispatches related events.
   */
  receive(eventName: RealtimeServerEvents.ServerEventType, event: any) {
    this._log('received:', eventName, event)
    this.dispatch(eventName, event)
    this.dispatch(`server.${eventName}`, event)
    this.dispatch('server.*', event)
  }

  /**
   * Sends an event to the underlying WebSocket and dispatches related events.
   */
  send(eventName: RealtimeClientEvents.ClientEventType, data: any = {}) {
    if (!this.isConnected) {
      throw new Error(`RealtimeAPI is not connected`)
    }
    data = data || {}
    if (typeof data !== 'object') {
      throw new TypeError(`data must be an object`)
    }

    const event = {
      event_id: generateId('evt_'),
      type: eventName,
      ...data
    }
    this.dispatch(eventName, event)
    this.dispatch(`client.${eventName}`, event)
    this.dispatch('client.*', event)
    this._log('sent:', eventName, event)
    this.ws!.send(JSON.stringify(event))
  }

  /**
   * Writes WebSocket logs to the console if `debug` is enabled.
   */
  protected _log(...args: any[]) {
    const date = new Date().toISOString()
    const logs = [`[Websocket/${date}]`].concat(args).map((arg) => {
      if (typeof arg === 'object' && arg !== null) {
        return JSON.stringify(trimDebugEvent(arg), null, 2)
      } else {
        return arg
      }
    })

    if (this.debug) {
      console.log(...logs)
    }
  }
}
