import type { Event } from './events'
import type { MaybePromise } from './types'

export type EventHandlerCallback<EventData> = (
  event: EventData
) => MaybePromise<unknown>

/**
 * Basic event handler.
 */
export class RealtimeEventHandler<
  EventType extends string = string,
  EventData extends Event = Event,
  EventMap extends Record<EventType, EventData> = Record<EventType, EventData>
> {
  eventHandlers: Record<EventType, EventHandlerCallback<EventData>[]> =
    {} as Record<EventType, EventHandlerCallback<EventData>[]>

  /**
   * Clears all event handlers.
   */
  clearEventHandlers() {
    this.eventHandlers = {} as Record<
      EventType,
      EventHandlerCallback<EventData>[]
    >
  }

  /**
   * Adds a listener for a specific event.
   */
  on<
    E extends EventType,
    D extends EventData = EventMap[E] extends EventData
      ? EventMap[E]
      : EventData
  >(eventName: E, callback: EventHandlerCallback<D>) {
    this.eventHandlers[eventName] = this.eventHandlers[eventName] || []
    this.eventHandlers[eventName].push(
      callback as EventHandlerCallback<EventData>
    )
  }

  /**
   * Adds a listener for a single occurrence of an event.
   */
  once<
    E extends EventType,
    D extends EventData = EventMap[E] extends EventData
      ? EventMap[E]
      : EventData
  >(eventName: E, callback: EventHandlerCallback<D>) {
    const onceCallback = (event: D) => {
      this.off(eventName, onceCallback)
      return callback(event)
    }
    this.on(eventName, onceCallback)
  }

  /**
   * Removes a listener for an event.
   * Calling without a callback will remove all listeners for the event.
   */
  off<
    E extends EventType,
    D extends EventData = EventMap[E] extends EventData
      ? EventMap[E]
      : EventData
  >(eventName: E, callback?: EventHandlerCallback<D>) {
    const handlers = this.eventHandlers[eventName] || []
    if (callback) {
      const index = handlers.indexOf(
        callback as EventHandlerCallback<EventData>
      )
      if (index < 0) {
        throw new Error(
          `Could not turn off specified event listener for "${eventName}": not found as a listener`
        )
      }

      handlers.splice(index, 1)
    } else {
      delete this.eventHandlers[eventName]
    }
  }

  /**
   * Waits for next event of a specific type and returns the payload.
   */
  async waitForNext<
    E extends EventType,
    D extends EventData = EventMap[E] extends EventData
      ? EventMap[E]
      : EventData
  >(eventName: E, { timeoutMs }: { timeoutMs?: number } = {}): Promise<D> {
    return new Promise<D>((resolve, reject) => {
      this.once(eventName, resolve as any)

      if (timeoutMs !== undefined) {
        setTimeout(
          () => reject(new Error(`Timeout waiting for "${eventName}"`)),
          timeoutMs
        )
      }
    })
  }

  /**
   * Executes all events handlers in the order they were added.
   */
  dispatch<
    E extends EventType,
    D extends EventData = EventMap[E] extends EventData
      ? EventMap[E]
      : EventData
  >(eventName: E, event: D) {
    const handlers = this.eventHandlers[eventName] || []
    for (const handler of handlers) {
      handler(event)
    }
  }
}
