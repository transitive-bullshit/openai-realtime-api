import type { MaybePromise } from './types'

export type EventHandlerCallback<EventData> = (
  event: EventData
) => MaybePromise<unknown>

/**
 * Basic event handler.
 */
export class RealtimeEventHandler<
  EventType extends string = string,
  EventData = any
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
  on(eventName: EventType, callback: EventHandlerCallback<EventData>) {
    this.eventHandlers[eventName] = this.eventHandlers[eventName] || []
    this.eventHandlers[eventName].push(callback)
  }

  /**
   * Adds a listener for a single occurrence of an event.
   */
  once(eventName: EventType, callback: EventHandlerCallback<EventData>) {
    const onceCallback = (event: EventData) => {
      this.off(eventName, onceCallback)
      return callback(event)
    }
    this.on(eventName, onceCallback)
  }

  /**
   * Removes a listener for an event.
   * Calling without a callback will remove all listeners for the event.
   */
  off(eventName: EventType, callback?: EventHandlerCallback<EventData>) {
    const handlers = this.eventHandlers[eventName] || []
    if (callback) {
      const index = handlers.indexOf(callback)
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
  async waitForNext(
    eventName: EventType,
    { timeoutMs }: { timeoutMs?: number } = {}
  ): Promise<EventData> {
    return new Promise((resolve, reject) => {
      this.once(eventName, resolve)

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
  dispatch(eventName: EventType, event: EventData) {
    const handlers = this.eventHandlers[eventName] || []
    for (const handler of handlers) {
      handler(event)
    }
  }
}
