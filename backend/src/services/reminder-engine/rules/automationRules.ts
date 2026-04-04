import prisma from '../../../prisma/client';
import { eventBus, AnyEventEnvelope } from '../events/eventBus';
import { ReminderStatus } from '../types/reminderTypes';

function computeTriggerTime(delayMinutes: number): Date {
  const now = new Date();
  return new Date(now.getTime() + delayMinutes * 60 * 1000);
}

export async function handleAutomationEvent(envelope: AnyEventEnvelope) {
  const { eventName, payload } = envelope;

  const rules = await prisma.automationRule.findMany({
    where: {
      eventName,
      enabled: true,
    },
  });

  if (!rules.length) return;

  const baseModuleName = payload.moduleName || 'Unknown';
  const baseEntityId =
    payload.entityId ||
    (payload as any).invoiceId ||
    (payload as any).leadId ||
    (payload as any).leaseId ||
    (payload as any).requestId ||
    'unknown';

  for (const rule of rules) {
    const triggerTime = computeTriggerTime(rule.delayMinutes);

    await prisma.reminder.create({
      data: {
        title: payload.title || `${eventName} Reminder`,
        description:
          payload.description ||
          `Automated reminder for event ${eventName} (entity ${baseEntityId})`,
        moduleName: rule.moduleName || baseModuleName,
        recordId: baseEntityId,
        assignedToUser: payload.assignedUserId || payload.userId || '',
        reminderDate: triggerTime,
        reminderTime: triggerTime,
        triggerTime,
        priority: 'medium',
        status: 'pending' as ReminderStatus,
        createdBy: payload.createdBy || payload.userId || '',
      },
    });
  }
}

export function registerAutomationRuleHandlers() {
  eventBus.onAny((envelope) => {
    // Fire and forget; errors are logged by Prisma middleware/logger
    void handleAutomationEvent(envelope);
  });
}

