import type { MaybePromise } from './types'
import { sleep } from './utils'

export type EventHandlerCallback<EventData = any> = (
  event: EventData
) => MaybePromise<unknown>

/**
 * Inherited class for RealtimeAPI and RealtimeClient
 * Adds basic event handling
 * @class
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
    const onceCallback = (event: any) => {
      this.off(eventName, onceCallback)
      return callback(event)
    }
    this.on(eventName, onceCallback)
  }

  /**
   * Turns off event listening for specific events.
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
   * Waits for next event of a specific type and returns the payload
   */
  async waitForNext(
    eventName: EventType,
    { timeoutMs }: { timeoutMs?: number } = {}
  ): Promise<any | null> {
    const t0 = Date.now()

    let nextEvent: any
    this.once(eventName, (event) => {
      nextEvent = event
    })

    while (!nextEvent) {
      if (timeoutMs !== undefined) {
        const t1 = Date.now()
        if (t1 - t0 > timeoutMs) {
          return null
        }
      }
      await sleep(1)
    }

    return nextEvent
  }

  /**
   * Executes all events handlers in the order they were added.
   */
  dispatch(eventName: EventType, event: any) {
    const handlers = this.eventHandlers[eventName] || []
    for (const handler of handlers) {
      handler(event)
    }
  }
}
