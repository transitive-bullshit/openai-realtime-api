import type {
  Event,
  RealtimeClientEvents,
  RealtimeCustomEvents,
  RealtimeServerEvents
} from './events'
import type {
  EventHandlerResult,
  FormattedTool,
  Realtime,
  ToolHandler
} from './types'
import { RealtimeAPI } from './api'
import { RealtimeConversation } from './conversation'
import { RealtimeEventHandler } from './event-handler'
import { arrayBufferToBase64, assert, mergeInt16Arrays, sleep } from './utils'

/**
 * The RealtimeClient class is the main interface for interacting with the
 * OpenAI Realtime API. It handles connection, configuration, conversation
 * updates, and server event handling.
 */
export class RealtimeClient extends RealtimeEventHandler<
  | RealtimeClientEvents.EventType
  | RealtimeServerEvents.EventType
  | RealtimeCustomEvents.EventType,
  Event,
  RealtimeClientEvents.EventMap &
    RealtimeServerEvents.EventMap &
    RealtimeCustomEvents.EventMap
> {
  readonly defaultSessionConfig: Realtime.SessionConfig
  sessionConfig: Realtime.SessionConfig

  readonly relay: boolean

  realtime: RealtimeAPI
  conversation: RealtimeConversation

  inputAudioBuffer: Int16Array
  sessionCreated: boolean
  tools: Record<
    string,
    {
      definition: Realtime.ToolDefinition
      handler: ToolHandler
    }
  >

  constructor({
    sessionConfig,
    relay = false,
    ...apiParams
  }: {
    sessionConfig?: Partial<Omit<Realtime.SessionConfig, 'tools'>>
    apiKey?: string
    model?: string
    url?: string
    dangerouslyAllowAPIKeyInBrowser?: boolean
    debug?: boolean
    /**
     * Relay mode disables tool use, since it will be the responsibility of the
     * upstream client to handle tool calls.
     */
    relay?: boolean
  } = {}) {
    super()

    this.defaultSessionConfig = {
      modalities: ['text', 'audio'],
      voice: 'alloy',
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      input_audio_transcription: {
        model: 'whisper-1'
      },
      turn_detection: null,
      // turn_detection: {
      //   type: 'server_vad',
      //   threshold: 0.5,
      //   prefix_padding_ms: 300,
      //   silence_duration_ms: 500
      // },
      tools: [],
      tool_choice: 'auto',
      temperature: 0.8,
      max_response_output_tokens: 4096,
      ...sessionConfig
    }
    this.sessionConfig = {}
    this.sessionCreated = false
    this.tools = {}
    this.inputAudioBuffer = new Int16Array(0)
    this.relay = !!relay

    this.realtime = new RealtimeAPI(apiParams)
    this.conversation = new RealtimeConversation({ debug: apiParams.debug })

    this._resetConfig()
    this._addAPIEventHandlers()
  }

  /**
   * Resets sessionConfig and conversation to defaults.
   */
  protected _resetConfig() {
    this.sessionCreated = false
    this.tools = {}
    this.sessionConfig = structuredClone(this.defaultSessionConfig)
    this.inputAudioBuffer = new Int16Array(0)
  }

  /**
   * Sets up event handlers for a fully-functional application control flow.
   */
  protected _addAPIEventHandlers() {
    // Event Logging handlers
    this.realtime.on('client.*', (event: any) => {
      this.dispatch('realtime.event', {
        type: 'realtime.event',
        time: new Date().toISOString(),
        source: 'client',
        event
      })
    })

    this.realtime.on('server.*', (event: RealtimeServerEvents.ServerEvent) => {
      this.dispatch('realtime.event', {
        type: 'realtime.event',
        time: new Date().toISOString(),
        source: 'server',
        event
      })
    })

    // Handles session created event
    this.realtime.on('server.session.created', () => {
      this.sessionCreated = true
    })

    // Setup for application control flow
    const handler = (event: any, ...args: any[]): EventHandlerResult => {
      if (!this.isConnected) return {}
      return this.conversation.processEvent(event, ...args)
    }

    const handlerWithDispatch = (event: any, ...args: any[]) => {
      const res = handler(event, ...args)

      if (res.item) {
        // FIXME: This is only here because `item.input_audio_transcription.completed`
        // can fire before `item.created`, resulting in empty item. This happens in
        // VAD mode with empty audio.
        this.dispatch('conversation.updated', {
          type: 'conversation.updated',
          ...res
        })
      }

      return res
    }

    const callTool = async (tool: FormattedTool) => {
      // In relay mode, we don't attempt to call tools. That is the
      // responsibility of the upstream client.
      if (this.isRelay) return

      try {
        const jsonArguments = JSON.parse(tool.arguments)
        const toolConfig = this.tools[tool.name]
        if (!toolConfig) {
          console.warn(`Tool "${tool.name}" not found`)
          return
        }

        const result = await Promise.resolve(toolConfig.handler(jsonArguments))
        this.realtime.send('conversation.item.create', {
          item: {
            type: 'function_call_output',
            call_id: tool.call_id,
            output: JSON.stringify(result)
          }
        })
      } catch (err: any) {
        console.warn(`Error calling tool "${tool.name}":`, err.message)

        this.realtime.send('conversation.item.create', {
          item: {
            type: 'function_call_output',
            call_id: tool.call_id,
            output: JSON.stringify({ error: err.message })
          }
        })
      }

      this.createResponse()
    }

    // Handlers to update internal conversation state
    this.realtime.on('server.response.created', handler)
    this.realtime.on('server.response.output_item.added', handler)
    this.realtime.on('server.response.content_part.added', handler)
    this.realtime.on(
      'server.input_audio_buffer.speech_started',
      (event: RealtimeServerEvents.InputAudioBufferSpeechStartedEvent) => {
        handler(event)
        this.dispatch('conversation.interrupted', event)
      }
    )
    this.realtime.on(
      'server.input_audio_buffer.speech_stopped',
      (event: RealtimeServerEvents.InputAudioBufferSpeechStoppedEvent) => {
        handler(event, this.inputAudioBuffer)
      }
    )

    // Handlers to update application state
    this.realtime.on(
      'server.conversation.item.created',
      (event: RealtimeServerEvents.ConversationItemCreatedEvent) => {
        const res = handlerWithDispatch(event)
        if (!res.item) return

        this.dispatch('conversation.item.appended', {
          type: 'conversation.item.appended',
          ...res
        })

        if (res.item.status === 'completed') {
          this.dispatch('conversation.item.completed', {
            type: 'conversation.item.completed',
            ...res
          })
        }
      }
    )
    this.realtime.on('server.conversation.item.truncated', handlerWithDispatch)
    this.realtime.on('server.conversation.item.deleted', handlerWithDispatch)
    this.realtime.on(
      'server.conversation.item.input_audio_transcription.completed',
      handlerWithDispatch
    )
    this.realtime.on(
      'server.response.audio_transcript.delta',
      handlerWithDispatch
    )
    this.realtime.on('server.response.audio.delta', handlerWithDispatch)
    this.realtime.on('server.response.text.delta', handlerWithDispatch)
    this.realtime.on(
      'server.response.function_call_arguments.delta',
      handlerWithDispatch
    )
    this.realtime.on(
      'server.response.output_item.done',
      async (event: RealtimeServerEvents.ResponseOutputItemDoneEvent) => {
        const res = handlerWithDispatch(event)
        if (!res.item?.formatted) return

        if (res.item.status === 'completed') {
          this.dispatch('conversation.item.completed', {
            type: 'conversation.item.completed',
            ...res
          })
        }

        if (res.item.formatted.tool) {
          callTool(res.item.formatted.tool)
        }
      }
    )
  }

  /**
   * Whether the realtime socket is connected.
   */
  get isConnected(): boolean {
    return this.realtime.isConnected
  }

  /**
   * Whether the client is in relay mode. When in relay mode, the client will
   * not attempt to invoke tools.
   */
  get isRelay(): boolean {
    return this.relay
  }

  /**
   * Resets the client instance entirely: disconnects and clears configs.
   */
  reset() {
    this.disconnect()
    this.clearEventHandlers()
    this.realtime.clearEventHandlers()
    this._resetConfig()
    this._addAPIEventHandlers()
  }

  /**
   * Connects to the Realtime WebSocket API and updates the session config.
   */
  async connect() {
    if (this.isConnected) {
      return
    }

    await this.realtime.connect()
    this.updateSession()
  }

  /**
   * Waits for a session.created event to be executed before proceeding.
   */
  async waitForSessionCreated() {
    assert(this.isConnected, 'Not connected, use .connect() first')

    while (!this.sessionCreated) {
      await sleep(1)
    }
  }

  /**
   * Disconnects from the Realtime API and clears the conversation history.
   */
  disconnect() {
    this.sessionCreated = false
    this.realtime.disconnect()
    this.conversation.clear()
  }

  /**
   * Gets the active turn detection mode.
   */
  getTurnDetectionType(): 'server_vad' | undefined {
    return this.sessionConfig.turn_detection?.type
  }

  /**
   * Adds a tool to the session.
   */
  addTool(definition: Realtime.PartialToolDefinition, handler: ToolHandler) {
    assert(!this.isRelay, 'Unable to add tools in relay mode')
    assert(definition?.name, 'Missing tool name in definition')
    const { name } = definition

    assert(
      typeof handler === 'function',
      `Tool "${name}" handler must be a function`
    )

    this.tools[name] = {
      definition: {
        type: 'function',
        ...definition
      },
      handler
    }
    this.updateSession()
  }

  /**
   * Removes a tool from the session.
   */
  removeTool(name: string) {
    assert(!this.isRelay, 'Unable to add tools in relay mode')
    assert(
      this.tools[name],
      `Tool "${name}" does not exist, can not be removed.`
    )
    delete this.tools[name]
    this.updateSession()
  }

  /**
   * Deletes an item.
   */
  deleteItem(id: string) {
    this.realtime.send('conversation.item.delete', { item_id: id })
  }

  /**
   * Updates session configuration.
   *
   * If the client is not yet connected, the session will be updated upon connection.
   */
  updateSession(sessionConfig: Realtime.SessionConfig = {}) {
    const tools = Object.values(this.tools).map(({ definition }) => definition)

    this.sessionConfig = {
      ...this.sessionConfig,
      ...sessionConfig,
      tools
    }

    if (this.isConnected && !this.isRelay) {
      this.realtime.send('session.update', {
        session: structuredClone(this.sessionConfig)
      })
    }
  }

  /**
   * Sends user message content and generates a response.
   */
  sendUserMessageContent(
    content: Array<
      Realtime.InputTextContentPart | Realtime.InputAudioContentPart
    >
  ) {
    assert(!this.isRelay, 'Unable to send messages directly in relay mode')

    if (content.length) {
      this.realtime.send('conversation.item.create', {
        item: {
          type: 'message',
          role: 'user',
          content
        }
      })
    }

    this.createResponse()
  }

  /**
   * Appends user audio to the existing audio buffer.
   */
  appendInputAudio(arrayBuffer: Int16Array | ArrayBuffer) {
    assert(!this.isRelay, 'Unable to append input audio directly in relay mode')

    if (arrayBuffer.byteLength > 0) {
      this.realtime.send('input_audio_buffer.append', {
        audio: arrayBufferToBase64(arrayBuffer)
      })

      this.inputAudioBuffer = mergeInt16Arrays(
        this.inputAudioBuffer,
        arrayBuffer
      )
    }
  }

  /**
   * Forces the model to generate a response.
   */
  createResponse() {
    assert(!this.isRelay, 'Unable to create a response directly in relay mode')

    if (!this.getTurnDetectionType() && this.inputAudioBuffer.byteLength > 0) {
      this.realtime.send('input_audio_buffer.commit')
      this.conversation.queueInputAudio(this.inputAudioBuffer)
      this.inputAudioBuffer = new Int16Array(0)
    }

    this.realtime.send('response.create')
  }

  /**
   * Cancels the ongoing server generation and truncates ongoing generation, if
   * applicable.
   *
   * If no id provided, will simply call `cancel_generation` command.
   */
  cancelResponse(
    /** The ID of the item to cancel. */
    id?: string,
    /** The number of samples to truncate past for the ongoing generation. */
    sampleCount = 0
  ): Realtime.AssistantItem | undefined {
    assert(!this.isRelay, 'Unable to cancel a response directly in relay mode')

    if (!id) {
      this.realtime.send('response.cancel')
      return
    }

    const item = this.conversation.getItem(id)
    assert(item, `Could not find item "${id}"`)
    assert(
      item.type === 'message',
      `Can only cancelResponse messages with type "message"`
    )
    assert(
      item.role === 'assistant',
      `Can only cancelResponse messages with role "assistant"`
    )

    this.realtime.send('response.cancel')
    const audioIndex = item.content.findIndex((c) => c.type === 'audio')
    assert(audioIndex >= 0, `Could not find audio on item ${id} to cancel`)

    this.realtime.send('conversation.item.truncate', {
      item_id: id,
      content_index: audioIndex,
      audio_end_ms: Math.floor(
        (sampleCount / this.conversation.defaultFrequency) * 1000
      )
    })

    return item
  }

  /**
   * Utility for waiting for the next `conversation.item.appended` event to be
   * triggered by the server.
   */
  async waitForNextItem(): Promise<Realtime.Item> {
    const event = await this.waitForNext('conversation.item.appended')
    return event.item
  }

  /**
   * Utility for waiting for the next `conversation.item.completed` event to be
   * triggered by the server.
   */
  async waitForNextCompletedItem(): Promise<Realtime.Item> {
    const event = await this.waitForNext('conversation.item.completed')
    return event.item
  }
}
