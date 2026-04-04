"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventBus = void 0;
exports.emitDomainEvent = emitDomainEvent;
const events_1 = require("events");
const ANY_EVENT = '__any__';
class EventBus extends events_1.EventEmitter {
    emitEvent(eventName, payload) {
        const basePayload = payload;
        const emitted = super.emit(eventName, payload);
        super.emit(ANY_EVENT, { eventName: eventName, payload: basePayload });
        return emitted;
    }
    onEvent(eventName, listener) {
        super.on(eventName, listener);
        return this;
    }
    onAny(listener) {
        super.on(ANY_EVENT, listener);
        return this;
    }
}
exports.eventBus = new EventBus();
function emitDomainEvent(eventName, payload) {
    exports.eventBus.emitEvent(eventName, payload);
}
//# sourceMappingURL=eventBus.js.map