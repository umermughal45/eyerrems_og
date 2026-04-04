import { EventEmitter } from 'events';
import {
  DomainEventPayloadBase,
  DomainEventPayloadMap,
} from '../types/reminderTypes';

const ANY_EVENT = '__any__';

type EventName = keyof DomainEventPayloadMap | string;

export interface AnyEventEnvelope {
  eventName: string;
  payload: DomainEventPayloadBase;
}

class EventBus extends EventEmitter {
  emitEvent<K extends keyof DomainEventPayloadMap>(
    eventName: K,
    payload: DomainEventPayloadMap[K]
  ): boolean {
    const basePayload = payload as DomainEventPayloadBase;
    const emitted = super.emit(eventName as string, payload);
    super.emit(ANY_EVENT, { eventName: eventName as string, payload: basePayload });
    return emitted;
  }

  onEvent<K extends keyof DomainEventPayloadMap>(
    eventName: K,
    listener: (payload: DomainEventPayloadMap[K]) => void
  ): this {
    super.on(eventName as string, listener as any);
    return this;
  }

  onAny(listener: (envelope: AnyEventEnvelope) => void): this {
    super.on(ANY_EVENT, listener as any);
    return this;
  }
}

export const eventBus = new EventBus();

export function emitDomainEvent(
  eventName: EventName,
  payload: DomainEventPayloadBase
): void {
  eventBus.emitEvent(eventName, payload as any);
}

