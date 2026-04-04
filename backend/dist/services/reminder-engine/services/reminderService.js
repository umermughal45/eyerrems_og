"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeTriggerTime = computeTriggerTime;
exports.updateReminderTriggerTime = updateReminderTriggerTime;
const client_1 = __importDefault(require("../../../prisma/client"));
function computeTriggerTime(reminderDate, reminderTime) {
    // Use reminderDate's date part and reminderTime's time part
    const date = new Date(reminderDate);
    const time = new Date(reminderTime);
    const trigger = new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes(), time.getSeconds(), time.getMilliseconds());
    return trigger;
}
async function updateReminderTriggerTime(reminderId) {
    const reminder = await client_1.default.reminder.findUnique({
        where: { id: reminderId },
    });
    if (!reminder)
        return;
    const triggerTime = computeTriggerTime(reminder.reminderDate, reminder.reminderTime);
    await client_1.default.reminder.update({
        where: { id: reminderId },
        data: {
            triggerTime,
            status: reminder.status || 'pending',
        },
    });
}
//# sourceMappingURL=reminderService.js.map