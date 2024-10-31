export namespace Realtime {
  export type AudioFormat = 'pcm16' | 'g711_ulaw' | 'g711_alaw'
  export type AudioTranscriptionModel = 'whisper-1' | (string & {})

  export type ItemRole = 'user' | 'assistant' | 'system'
  export type ItemType = 'message' | 'function_call' | 'function_call_output'
  export type ItemStatus = 'in_progress' | 'completed' | 'incomplete'
  export type ContentPartType = 'input_text' | 'input_audio' | 'text' | 'audio'

  export type Voice = 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse'

  export type ToolChoice =
    | 'auto'
    | 'none'
    | 'required'
    | { type: 'function'; name: string }

  export type ObjectType =
    | 'realtime.item'
    | 'realtime.response'
    | 'realtime.session'
    | 'realtime.conversation'

  export type ResponseStatus =
    | 'in_progress'
    | 'completed'
    | 'incomplete'
    | 'cancelled'
    | 'failed'

  export interface BaseObject {
    /** The unique ID of the object. */
    id?: string

    /** Discriminator for the type of this object. */
    object?: ObjectType
  }

  export interface AudioTranscription {
    model: AudioTranscriptionModel
  }

  export interface TurnDetection {
    type: 'server_vad'

    /** 0.0 to 1.0 */
    threshold?: number

    /** How much audio to include in the audio stream before the speech starts. */
    prefix_padding_ms?: number

    /** How long to wait to mark the speech as stopped. */
    silence_duration_ms?: number
  }

  export interface ToolDefinition {
    type: 'function'
    name: string
    description: string
    parameters: { [key: string]: any }
  }

  export type PartialToolDefinition = Omit<ToolDefinition, 'type'> & {
    type?: 'function'
  }

  export interface SessionConfig {
    /** The default system instructions prepended to model calls. */
    instructions?: string

    /**
     * The set of modalities the model can respond with. To disable audio, set
     * this to ["text"].
     */
    modalities?: string[]

    /**
     * The voice the model uses to respond - one of alloy, echo, or shimmer.
     *
     * Cannot be changed once the model has responded with audio at least once.
     */
    voice?: Voice

    /** The format of input audio. */
    input_audio_format?: AudioFormat

    /** The format of output audio. */
    output_audio_format?: AudioFormat

    /** Configuration for input audio transcription. Can be set to null to turn off. */
    input_audio_transcription?: AudioTranscription | null

    /** Configuration for turn detection. Can be set to null to turn off. */
    turn_detection?: TurnDetection | null

    /** Tools (functions) available to the model. */
    tools?: ToolDefinition[]

    /** How the model chooses tools. */
    tool_choice?: ToolChoice

    /** Sampling temperature for the model. */
    temperature?: number

    /**
     * Maximum number of output tokens for a single assistant response, inclusive
     * of tool calls. Provide an integer between 1 and 4096 to limit output
     * tokens, or "inf" for the maximum available tokens for a given model.
     *
     * Defaults to "inf".
     */
    max_response_output_tokens?: number | 'inf'
  }

  export interface Session extends BaseObject, SessionConfig {
    /** The unique ID of the session. */
    id: string

    /** Type of object. */
    object: 'realtime.session'
  }

  export interface BaseContentPart {
    /** The type of the content. */
    type: ContentPartType

    /** Text content for "text" and "input_text" content parts. */
    text?: string

    /** Base64-encoded audio data. */
    audio?: string

    /** Optional text transcript. */
    transcript?: string | null
  }

  export interface InputTextContentPart extends BaseContentPart {
    type: 'input_text'
    text: string
  }

  export interface InputAudioContentPart extends BaseContentPart {
    type: 'input_audio'
    /** Base64-encoded audio data. */
    audio?: string
    transcript?: string | null
  }

  export interface TextContentPart extends BaseContentPart {
    type: 'text'
    text: string
  }

  export interface AudioContentPart extends BaseContentPart {
    type: 'audio'
    /** Base64-encoded audio data. */
    audio?: string
    transcript?: string | null
  }

  export type ContentPart =
    | InputTextContentPart
    | InputAudioContentPart
    | TextContentPart
    | AudioContentPart

  export interface BaseItem extends BaseObject {
    /** The unique ID of the item. */
    id: string

    /** Type of object. */
    object?: 'realtime.item'

    /** The type of the item. */
    type: ItemType

    /** The status of the item. */
    status: ItemStatus

    /** The role of the message sender. */
    role: ItemRole

    /** The content of the item. */
    content: ContentPart[]
  }

  export interface SystemItem {
    role: 'system'
    type: 'message'
    content: InputTextContentPart[]
  }

  export interface UserItem {
    role: 'user'
    type: 'message'
    content: Array<InputTextContentPart | InputAudioContentPart>
  }

  export interface AssistantItem {
    role: 'assistant'
    type: 'message'
    content: Array<TextContentPart | AudioContentPart>
  }

  export interface FunctionCallItem {
    type: 'function_call'

    /** The ID of the function call. */
    call_id: string

    /** The name of the function being called. */
    name: string

    /** The arguments of the function call. */
    arguments: string
  }

  export interface FunctionCallOutputItem {
    type: 'function_call_output'

    /** The ID of the function call. */
    call_id: string

    /** The output of the function call. */
    output: string
  }

  export type Item = BaseItem &
    (
      | SystemItem
      | UserItem
      | AssistantItem
      | FunctionCallItem
      | FunctionCallOutputItem
    )

  export type ClientItem =
    | SystemItem
    | UserItem
    | AssistantItem
    | FunctionCallItem
    | FunctionCallOutputItem

  export interface Usage {
    total_tokens: number
    input_tokens: number
    output_tokens: number
  }

  export interface ResponseConfig {
    /** Instructions for the model. */
    instructions?: string

    /**
     * The modalities for the response. To disable audio, set this to ["text"].
     */
    modalities?: string[]

    /**
     * The voice the model uses to respond - one of alloy, echo, or shimmer.
     */
    voice?: Voice

    /** The format of output audio. */
    output_audio_format?: AudioFormat

    /** Tools (functions) available to the model. */
    tools?: ToolDefinition[]

    /** How the model chooses tools. */
    tool_choice?: ToolChoice

    /** Sampling temperature for the model. */
    temperature?: number

    /**
     * Maximum number of output tokens for a single assistant response, inclusive
     * of tool calls. Provide an integer between 1 and 4096 to limit output
     * tokens, or "inf" for the maximum available tokens for a given model.
     * Defaults to "inf".
     */
    max_output_tokens?: number | 'inf'
  }

  export interface Response extends BaseObject, ResponseConfig {
    /** The unique ID of the response. */
    id: string

    /** Type of object. */
    object: 'realtime.response'

    /** Status of the response. */
    status: ResponseStatus

    /** Additional details about the status. */
    status_details?:
      | {
          type: 'incomplete'
          reason: 'interruption' | 'max_output_tokens' | 'content_filter'
        }
      | {
          type: 'failed'
          error?: Error | null
        }
      | null

    /** The list of output items generated by the response. */
    output: Item[]

    /** Usage statistics for the response. */
    usage?: Usage
  }

  export interface Error {
    /** The type of error. */
    type: string

    /** Error code, if any. */
    code?: string

    /** A human-readable error message. */
    message: string

    /** Parameter related to the error, if any. */
    param?: string | null

    /** Unique ID of the event, if any. */
    event_id?: string
  }

  export interface Conversation extends BaseObject {
    /** The unique ID of the conversation. */
    id: string

    /** Type of object. */
    object: 'realtime.conversation'
  }

  export interface RateLimit {
    name: 'requests' | 'tokens' | (string & {})
    limit: number
    remaining: number
    reset_seconds: number
  }
}

// NOTE: all types outside of the Realtime namespace are local to this project
// and not part of the official API.

export type MaybePromise<T> = T | Promise<T>

export interface FormattedTool {
  type: 'function'
  name: string
  call_id: string
  arguments: string
}

export interface FormattedProperty {
  audio: Int16Array
  text: string
  transcript: string
  tool?: FormattedTool
  output?: string
  file?: any
}

/** Local item used strictly for convenience and not part of the API. */
export type FormattedItem = Realtime.Item & {
  formatted: FormattedProperty
}

/** Local item used strictly for convenience and not part of the API. */
export type MaybeFormattedItem = Realtime.Item & {
  formatted?: FormattedProperty
}

export interface EventHandlerResult {
  item?: MaybeFormattedItem
  delta?: {
    transcript?: string
    audio?: Int16Array
    text?: string
    arguments?: string
  }
  response?: Realtime.Response
}

export type ToolHandler = (params: any) => MaybePromise<any>
