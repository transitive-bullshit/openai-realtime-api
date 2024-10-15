import type { Realtime } from './types'

export interface Event {
  /** The event type. */
  type: string
}

// See https://platform.openai.com/docs/guides/realtime/events
export namespace RealtimeClientEvents {
  /** Event types sent by the client. */
  export type ClientEventType =
    | 'session.update'
    | 'input_audio_buffer.append'
    | 'input_audio_buffer.commit'
    | 'input_audio_buffer.clear'
    | 'conversation.item.create'
    | 'conversation.item.truncate'
    | 'conversation.item.delete'
    | 'response.create'
    | 'response.cancel'

  export interface ClientEvent extends Event {
    /** The event type. */
    type: ClientEventType

    /** Optional client-generated ID used to identify this event. */
    event_id?: string
  }

  /** Send this event to update the session’s default configuration. */
  export interface SessionUpdateEvent extends ClientEvent {
    type: 'session.update'

    /** Session configuration to update. */
    session: Realtime.SessionConfig
  }

  /** Send this event to append audio bytes to the input audio buffer. */
  export interface InputAudioBufferAppendEvent extends ClientEvent {
    type: 'input_audio_buffer.append'

    /** Base64-encoded audio bytes. */
    audio: string
  }

  /** Send this event to commit audio bytes to a user message. */
  export interface InputAudioBufferCommitEvent extends ClientEvent {
    type: 'input_audio_buffer.commit'
  }

  /** Send this event to clear the audio bytes in the buffer. */
  export interface InputAudioBufferClearEvent extends ClientEvent {
    type: 'input_audio_buffer.clear'
  }

  /** Send this event when adding an item to the conversation. */
  export interface ConversationItemCreateEvent extends ClientEvent {
    type: 'conversation.item.create'

    /** The ID of the preceding item after which the new item will be inserted. */
    previous_item_id?: string

    /** The item to add to the conversation. */
    item?: Realtime.Item
  }

  /**
   * Send this event when you want to truncate a previous assistant message’s audio.
   */
  export interface ConversationItemTruncateEvent extends ClientEvent {
    type: 'conversation.item.truncate'

    /** The ID of the assistant message item to truncate. */
    item_id: string

    /** The index of the content part to truncate. */
    content_index: number

    /** Inclusive duration up to which audio is truncated, in milliseconds. */
    audio_end_ms: number
  }

  /**
   * Send this event when you want to remove any item from the conversation history.
   */
  export interface ConversationItemDeleteEvent extends ClientEvent {
    type: 'conversation.item.delete'

    /** The ID of the item to delete. */
    item_id: string
  }

  /** Send this event to trigger a response generation. */
  export interface ResponseCreateEvent extends ClientEvent {
    type: 'response.create'

    /** Configuration for the response. */
    response: Realtime.ResponseConfig
  }

  /** Send this event to cancel an in-progress response. */
  export interface ResponseCancelEvent extends ClientEvent {
    type: 'response.cancel'
  }
}

// See // See https://platform.openai.com/docs/guides/realtime/events
export namespace RealtimeServerEvents {
  /** Event types sent by the server. */
  export type ServerEventType =
    | 'error'
    | 'session.created'
    | 'session.updated'
    | 'conversation.created'
    | 'conversation.item.created'
    | 'conversation.item.input_audio_transcription.completed'
    | 'conversation.item.input_audio_transcription.failed'
    | 'conversation.item.truncated'
    | 'conversation.item.deleted'
    | 'input_audio_buffer.committed'
    | 'input_audio_buffer.cleared'
    | 'input_audio_buffer.speech_started'
    | 'input_audio_buffer.speech_stopped'
    | 'response.created'
    | 'response.done'
    | 'response.output_item.added'
    | 'response.output_item.done'
    | 'response.content_part.added'
    | 'response.content_part.done'
    | 'response.text.delta'
    | 'response.text.done'
    | 'response.audio_transcript.delta'
    | 'response.audio_transcript.done'
    | 'response.audio.delta'
    | 'response.audio.done'
    | 'response.function_call_arguments.delta'
    | 'response.function_call_arguments.done'
    | 'rate_limits.updated'

  export interface ServerEvent extends Event {
    /** The event type. */
    type: ServerEventType

    /** The unique ID of the server event. */
    event_id: string
  }

  /** Returned when an error occurs. */
  export interface ErrorEvent extends ServerEvent {
    type: 'error'

    /** Details of the error. */
    error: Realtime.Error
  }

  /**
   * Returned when a session is created. Emitted automatically when a new
   * connection is established.
   */
  export interface SessionCreatedEvent extends ServerEvent {
    type: 'session.created'

    /** The session resource. */
    session: Realtime.Session
  }

  /**
   * Returned when a session is updated.
   */
  export interface SessionUpdatedEvent extends ServerEvent {
    type: 'session.updated'

    /** The updated session resource. */
    session: Realtime.Session
  }

  /**
   * Returned when a conversation is created. Emitted right after session
   * creation.
   */
  export interface ConversationCreatedEvent extends ServerEvent {
    type: 'conversation.created'

    /** The conversation resource. */
    conversation: Realtime.Conversation
  }

  /**
   * Returned when a conversation item is created.
   */
  export interface ConversationItemCreatedEvent extends ServerEvent {
    type: 'conversation.item.created'

    /** The ID of the preceding item. */
    previous_item_id?: string

    /** The item that was created. */
    item: Realtime.Item
  }

  /**
   * Returned when input audio transcription is enabled and a transcription succeeds.
   */
  export interface ConversationItemInputAudioTranscriptionCompletedEvent
    extends ServerEvent {
    type: 'conversation.item.input_audio_transcription.completed'

    /** The ID of the user message item. */
    item_id: string

    /** The index of the content part containing the audio. */
    content_index: number

    /** The transcribed text. */
    transcript: string
  }

  /**
   * Returned when input audio transcription is configured, and a transcription
   * request for a user message failed.
   */
  export interface ConversationItemInputAudioTranscriptionFailedEvent
    extends ServerEvent {
    type: 'conversation.item.input_audio_transcription.failed'

    /** The ID of the user message item. */
    item_id: string

    /** The index of the content part containing the audio. */
    content_index: number

    /** Details of the transcription error. */
    error: Realtime.Error
  }

  /**
   * Returned when an earlier assistant audio message item is truncated by the client.
   */
  export interface ConversationItemTruncatedEvent extends ServerEvent {
    type: 'conversation.item.truncated'

    /** The ID of the assistant message item that was truncated. */
    item_id: string

    /** The index of the content part thtat was truncated. */
    content_index: number

    /** The duration up to which the audio was truncated, in milliseconds. */
    audio_end_ms: number
  }

  /**
   * Returned when an item in the conversation is deleted.
   */
  export interface ConversationItemDeletedEvent extends ServerEvent {
    type: 'conversation.item.deleted'

    /** The ID of the item that was deleted. */
    item_id: string
  }

  /**
   * Returned when an input audio buffer is committed, either by the client or
   * automatically in server VAD mode.
   */
  export interface InputAudioBufferCommittedEvent extends ServerEvent {
    type: 'input_audio_buffer.committed'

    /** The ID of the preceding item after which the new item will be inserted. */
    previous_item_id?: string

    /** The ID of the user message item that will be created. */
    item_id: string
  }

  /**
   * Returned when the input audio buffer is cleared by the client.
   */
  export interface InputAudioBufferClearedEvent extends ServerEvent {
    type: 'input_audio_buffer.cleared'
  }

  /**
   * Returned in server turn detection mode when speech is detected.
   */
  export interface InputAudioBufferSpeechStartedEvent extends ServerEvent {
    type: 'input_audio_buffer.speech_started'

    /** The ID of the user message item that will be created when speech stops. */
    item_id: string

    /** Milliseconds since the session started when speech was detected. */
    audio_start_ms: number
  }

  /**
   * Returned in server turn detection mode when speech stops.
   */
  export interface InputAudioBufferSpeechStoppedEvent extends ServerEvent {
    type: 'input_audio_buffer.speech_stopped'

    /** The ID of the user message item that will be created. */
    item_id: string

    /** Milliseconds since the session started when speech stopped. */
    audio_end_ms: number
  }

  /**
   * Returned when a new Response is created. The first event of response
   * creation, where the response is in an initial state of "in_progress".
   */
  export interface ResponseCreatedEvent extends ServerEvent {
    type: 'response.created'

    /** The response resource. */
    response: Realtime.Response
  }

  /**
   * Returned when a Response is done streaming. Always emitted, no matter the
   * final state.
   */
  export interface ResponseDoneEvent extends ServerEvent {
    type: 'response.done'

    /** The response resource. */
    response: Realtime.Response
  }

  /**
   * Returned when a new Item is created during response generation.
   */
  export interface ResponseOutputItemAddedEvent extends ServerEvent {
    type: 'response.output_item.added'

    /** The ID of the response. */
    response_id: string

    /** The index of the output item in the response. */
    output_index: string

    /** The item that was added. */
    item: Realtime.Item
  }

  /**
   * Returned when an Item is done streaming. Also emitted when a Response is
   * interrupted, incomplete, or cancelled.
   */
  export interface ResponseOutputItemDoneEvent extends ServerEvent {
    type: 'response.output_item.done'

    /** The ID of the response. */
    response_id: string

    /** The index of the output item in the response. */
    output_index: string

    /** The item that was added. */
    item: Realtime.Item
  }

  /**
   * Returned when a new content part is added to an assistant message item
   * during response generation.
   */
  export interface ResponseContentPartItemAddedEvent extends ServerEvent {
    type: 'response.content_part.added'

    /** The ID of the response. */
    response_id: string

    /** The ID of the item. */
    item_id: string

    /** The index of the output item in the response. */
    output_index: string

    /** The index of the content part in the item's content array. */
    content_index: number

    /** The content part. */
    part: Realtime.ContentPart
  }

  /**
   * Returned when a content part is done streaming in an assistant message item.
   * Also emitted when a Response is interrupted, incomplete, or cancelled.
   */
  export interface ResponseContentPartItemDoneEvent extends ServerEvent {
    type: 'response.content_part.done'

    /** The ID of the response. */
    response_id: string

    /** The ID of the item. */
    item_id: string

    /** The index of the output item in the response. */
    output_index: string

    /** The index of the content part in the item's content array. */
    content_index: number

    /** The content part. */
    part: Realtime.ContentPart
  }

  /**
   * Returned when the text value of a "text" content part is updated.
   */
  export interface ResponseTextDeltaEvent extends ServerEvent {
    type: 'response.text.delta'

    /** The ID of the response. */
    response_id: string

    /** The ID of the item. */
    item_id: string

    /** The index of the output item in the response. */
    output_index: string

    /** The index of the content part in the item's content array. */
    content_index: number

    /** The text delta. */
    delta: string
  }

  /**
   * Returned when the text value of a "text" content part is done streaming.
   * Also emitted when a Response is interrupted, incomplete, or cancelled.
   */
  export interface ResponseTextDoneEvent extends ServerEvent {
    type: 'response.text.done'

    /** The ID of the response. */
    response_id: string

    /** The ID of the item. */
    item_id: string

    /** The index of the output item in the response. */
    output_index: string

    /** The index of the content part in the item's content array. */
    content_index: number

    /** The final text content. */
    text: string
  }

  /**
   * Returned when the model-generated transcription of audio output is updated.
   */
  export interface ResponseAudioTranscriptDeltaEvent extends ServerEvent {
    type: 'response.audio_transcript.delta'

    /** The ID of the response. */
    response_id: string

    /** The ID of the item. */
    item_id: string

    /** The index of the output item in the response. */
    output_index: string

    /** The index of the content part in the item's content array. */
    content_index: number

    /** The transcript delta. */
    delta: string
  }

  /**
   * Returned when the model-generated transcription of audio output is done
   * streaming. Also emitted when a Response is interrupted, incomplete, or
   * cancelled.
   */
  export interface ResponseAudioTranscriptDoneEvent extends ServerEvent {
    type: 'response.audio_transcript.done'

    /** The ID of the response. */
    response_id: string

    /** The ID of the item. */
    item_id: string

    /** The index of the output item in the response. */
    output_index: string

    /** The index of the content part in the item's content array. */
    content_index: number

    /** The final transcript. */
    transcript: string
  }

  /**
   * Returned when the model-generated audio is updated.
   */
  export interface ResponseAudioDeltaEvent extends ServerEvent {
    type: 'response.audio.delta'

    /** The ID of the response. */
    response_id: string

    /** The ID of the item. */
    item_id: string

    /** The index of the output item in the response. */
    output_index: string

    /** The index of the content part in the item's content array. */
    content_index: number

    /** Base64-encoded audio data delta. */
    delta: string
  }

  /**
   * Returned when the model-generated audio is done. Also emitted when a
   * Response is interrupted, incomplete, or cancelled.
   */
  export interface ResponseAudioDoneEvent extends ServerEvent {
    type: 'response.audio.done'

    /** The ID of the response. */
    response_id: string

    /** The ID of the item. */
    item_id: string

    /** The index of the output item in the response. */
    output_index: string

    /** The index of the content part in the item's content array. */
    content_index: number
  }

  /**
   * Returned when the model-generated function call arguments are updated.
   */
  export interface ResponseFunctionCallArgumentsDeltaEvent extends ServerEvent {
    type: 'response.function_call_arguments.delta'

    /** The ID of the response. */
    response_id: string

    /** The ID of the item. */
    item_id: string

    /** The index of the output item in the response. */
    output_index: string

    /** The index of the content part in the item's content array. */
    content_index: number

    /** The ID of the function call. */
    call_id: string

    /** The arguments delta as a JSON string. */
    delta: string
  }

  /**
   * Returned when the model-generated function call arguments are done streaming.
   * Also emitted when a Response is interrupted, incomplete, or cancelled.
   */
  export interface ResponseFunctionCallArgumentsDoneEvent extends ServerEvent {
    type: 'response.function_call_arguments.done'

    /** The ID of the response. */
    response_id: string

    /** The ID of the item. */
    item_id: string

    /** The index of the output item in the response. */
    output_index: string

    /** The index of the content part in the item's content array. */
    content_index: number

    /** The ID of the function call. */
    call_id: string

    /** The final arguments as a JSON string. */
    arguments: string
  }

  /**
   * Emitted after every `response.done` event to indicate the updated rate
   * limits.
   */
  export interface RateLimitsUpdatedEvent extends ServerEvent {
    type: 'rate_limits.updated'

    /** Array of rate limit information. */
    rate_limits: Realtime.RateLimit[]
  }
}
