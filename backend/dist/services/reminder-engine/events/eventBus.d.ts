import { EventEmitter } from 'events';
import { DomainEventPayloadBase, DomainEventPayloadMap } from '../types/reminderTypes';
type EventName = keyof DomainEventPayloadMap | string;
export interface AnyEventEnvelope {
    eventName: string;
    payload: DomainEventPayloadBase;
}
declare class EventBus extends EventEmitter {
    emitEvent<K extends keyof DomainEventPayloadMap>(eventName: K, payload: DomainEventPayloadMap[K]): boolean;
    onEvent<K extends keyof DomainEventPayloadMap>(eventName: K, listener: (payload: DomainEventPayloadMap[K]) => void): this;
    onAny(listener: (envelope: AnyEventEnvelope) => void): this;
}
export declare const eventBus: EventBus;
export declare function emitDomainEvent(eventName: EventName, payload: DomainEventPayloadBase): void;
export {};
//# sourceMappingURL=eventBus.d.ts.map