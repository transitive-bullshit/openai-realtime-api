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

  api: RealtimeAPI
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
    ...apiParams
  }: {
    sessionConfig?: Partial<Omit<Realtime.SessionConfig, 'tools'>>
    apiKey?: string
    model?: string
    url?: string
    dangerouslyAllowAPIKeyInBrowser?: boolean
    debug?: boolean
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

    this.api = new RealtimeAPI(apiParams)
    this.conversation = new RealtimeConversation()

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
    this.api.on('client.*', (event: any) => {
      this.dispatch('realtime.event', {
        type: 'realtime.event',
        time: new Date().toISOString(),
        source: 'client',
        event
      })
    })

    this.api.on('server.*', (event: RealtimeServerEvents.ServerEvent) => {
      this.dispatch('realtime.event', {
        type: 'realtime.event',
        time: new Date().toISOString(),
        source: 'server',
        event
      })
    })

    // Handles session created event
    this.api.on('server.session.created', () => {
      this.sessionCreated = true
    })

    // Setup for application control flow
    const handler = (event: any, ...args: any[]): EventHandlerResult => {
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
      try {
        const jsonArguments = JSON.parse(tool.arguments)
        const toolConfig = this.tools[tool.name]
        if (!toolConfig) {
          throw new Error(`Tool "${tool.name}" has not been added`)
        }

        const result = await Promise.resolve(toolConfig.handler(jsonArguments))
        this.api.send('conversation.item.create', {
          item: {
            type: 'function_call_output',
            call_id: tool.call_id,
            output: JSON.stringify(result)
          }
        })
      } catch (err: any) {
        this.api.send('conversation.item.create', {
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
    this.api.on('server.response.created', handler)
    this.api.on('server.response.output_item.added', handler)
    this.api.on('server.response.content_part.added', handler)
    this.api.on(
      'server.input_audio_buffer.speech_started',
      (event: RealtimeServerEvents.InputAudioBufferSpeechStartedEvent) => {
        handler(event)
        this.dispatch('conversation.interrupted', event)
      }
    )
    this.api.on(
      'server.input_audio_buffer.speech_stopped',
      (event: RealtimeServerEvents.InputAudioBufferSpeechStoppedEvent) => {
        handler(event, this.inputAudioBuffer)
      }
    )

    // Handlers to update application state
    this.api.on(
      'server.conversation.item.created',
      (event: RealtimeServerEvents.ConversationItemCreatedEvent) => {
        const res = handlerWithDispatch(event)
        assert(res.item)

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
    this.api.on('server.conversation.item.truncated', handlerWithDispatch)
    this.api.on('server.conversation.item.deleted', handlerWithDispatch)
    this.api.on(
      'server.conversation.item.input_audio_transcription.completed',
      handlerWithDispatch
    )
    this.api.on('server.response.audio_transcript.delta', handlerWithDispatch)
    this.api.on('server.response.audio.delta', handlerWithDispatch)
    this.api.on('server.response.text.delta', handlerWithDispatch)
    this.api.on(
      'server.response.function_call_arguments.delta',
      handlerWithDispatch
    )
    this.api.on(
      'server.response.output_item.done',
      async (event: RealtimeServerEvents.ResponseOutputItemDoneEvent) => {
        const res = handlerWithDispatch(event)
        assert(res.item)
        assert(res.item.formatted)

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
    return this.api.isConnected
  }

  /**
   * Resets the client instance entirely: disconnects and clears configs.
   */
  reset() {
    this.disconnect()
    this.clearEventHandlers()
    this.api.clearEventHandlers()
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

    await this.api.connect()
    this.updateSession()
  }

  /**
   * Waits for a session.created event to be executed before proceeding.
   */
  async waitForSessionCreated() {
    if (!this.isConnected) {
      throw new Error(`Not connected, use .connect() first`)
    }

    while (!this.sessionCreated) {
      await sleep(1)
    }
  }

  /**
   * Disconnects from the Realtime API and clears the conversation history.
   */
  disconnect() {
    this.sessionCreated = false
    this.api.disconnect()
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
  addTool(definition: Realtime.ToolDefinition, handler: ToolHandler) {
    assert(definition?.name, `Missing tool name in definition`)
    const { name } = definition

    assert(
      typeof handler === 'function',
      `Tool "${name}" handler must be a function`
    )

    this.tools[name] = { definition, handler }
    this.updateSession()
  }

  /**
   * Removes a tool from the session.
   */
  removeTool(name: string) {
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
    this.api.send('conversation.item.delete', { item_id: id })
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

    if (this.isConnected) {
      this.api.send('session.update', { session: { ...this.sessionConfig } })
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
    if (content.length) {
      this.api.send('conversation.item.create', {
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
    if (arrayBuffer.byteLength > 0) {
      this.api.send('input_audio_buffer.append', {
        audio: arrayBufferToBase64(arrayBuffer)
      })

      this.inputAudioBuffer = mergeInt16Arrays(
        this.inputAudioBuffer,
        arrayBuffer
      )
    }
  }

  /**
   * Forces a model response generation.
   */
  createResponse() {
    if (!this.getTurnDetectionType() && this.inputAudioBuffer.byteLength > 0) {
      this.api.send('input_audio_buffer.commit')
      this.conversation.queueInputAudio(this.inputAudioBuffer)
      this.inputAudioBuffer = new Int16Array(0)
    }

    this.api.send('response.create')
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
    if (!id) {
      this.api.send('response.cancel')
      return
    } else if (id) {
      const item = this.conversation.getItem(id)
      if (!item) {
        throw new Error(`Could not find item "${id}"`)
      }

      if (item.type !== 'message') {
        throw new Error(`Can only cancelResponse messages with type "message"`)
      } else if (item.role !== 'assistant') {
        throw new Error(
          `Can only cancelResponse messages with role "assistant"`
        )
      }

      this.api.send('response.cancel')
      const audioIndex = item.content.findIndex((c) => c.type === 'audio')
      if (audioIndex === -1) {
        throw new Error(`Could not find audio on item to cancel`)
      }

      this.api.send('conversation.item.truncate', {
        item_id: id,
        content_index: audioIndex,
        audio_end_ms: Math.floor(
          (sampleCount / this.conversation.defaultFrequency) * 1000
        )
      })

      return item
    }
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
