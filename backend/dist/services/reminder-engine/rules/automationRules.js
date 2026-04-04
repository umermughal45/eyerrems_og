"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAutomationEvent = handleAutomationEvent;
exports.registerAutomationRuleHandlers = registerAutomationRuleHandlers;
const client_1 = __importDefault(require("../../../prisma/client"));
const eventBus_1 = require("../events/eventBus");
function computeTriggerTime(delayMinutes) {
    const now = new Date();
    return new Date(now.getTime() + delayMinutes * 60 * 1000);
}
async function handleAutomationEvent(envelope) {
    const { eventName, payload } = envelope;
    const rules = await client_1.default.automationRule.findMany({
        where: {
            eventName,
            enabled: true,
        },
    });
    if (!rules.length)
        return;
    const baseModuleName = payload.moduleName || 'Unknown';
    const baseEntityId = payload.entityId ||
        payload.invoiceId ||
        payload.leadId ||
        payload.leaseId ||
        payload.requestId ||
        'unknown';
    for (const rule of rules) {
        const triggerTime = computeTriggerTime(rule.delayMinutes);
        await client_1.default.reminder.create({
            data: {
                title: payload.title || `${eventName} Reminder`,
                description: payload.description ||
                    `Automated reminder for event ${eventName} (entity ${baseEntityId})`,
                moduleName: rule.moduleName || baseModuleName,
                recordId: baseEntityId,
                assignedToUser: payload.assignedUserId || payload.userId || '',
                reminderDate: triggerTime,
                reminderTime: triggerTime,
                triggerTime,
                priority: 'medium',
                status: 'pending',
                createdBy: payload.createdBy || payload.userId || '',
            },
        });
    }
}
function registerAutomationRuleHandlers() {
    eventBus_1.eventBus.onAny((envelope) => {
        // Fire and forget; errors are logged by Prisma middleware/logger
        void handleAutomationEvent(envelope);
    });
}
//# sourceMappingURL=automationRules.js.map