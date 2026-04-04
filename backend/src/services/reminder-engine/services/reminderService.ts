import prisma from '../../../prisma/client';
import { ReminderStatus } from '../types/reminderTypes';

export function computeTriggerTime(
  reminderDate: Date,
  reminderTime: Date
): Date {
  // Use reminderDate's date part and reminderTime's time part
  const date = new Date(reminderDate);
  const time = new Date(reminderTime);

  const trigger = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    time.getHours(),
    time.getMinutes(),
    time.getSeconds(),
    time.getMilliseconds()
  );

  return trigger;
}

export async function updateReminderTriggerTime(reminderId: string) {
  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
  });
  if (!reminder) return;

  const triggerTime = computeTriggerTime(reminder.reminderDate, reminder.reminderTime);

  await prisma.reminder.update({
    where: { id: reminderId },
    data: {
      triggerTime,
      status: (reminder.status as ReminderStatus) || 'pending',
    },
  });
}

