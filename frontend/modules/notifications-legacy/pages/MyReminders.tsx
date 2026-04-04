import React, { useState } from 'react';
import { useCreateReminder, useDeleteReminder, useReminders, useUpdateReminder } from '../hooks/useReminders';
import { ReminderModal } from '../components/ReminderModal';
import { ReminderTable } from '../components/ReminderTable';
import type { CreateReminderPayload, ReminderDto } from '../services/reminderApi';

export default function MyReminders() {
  const { data: reminders = [], isLoading, error } = useReminders();
  const createReminder = useCreateReminder();
  const updateReminder = useUpdateReminder();
  const deleteReminder = useDeleteReminder();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ReminderDto | null>(null);

  const submit = async (payload: CreateReminderPayload) => {
    await createReminder.mutateAsync(payload);
  };

  const onEdit = (r: ReminderDto) => {
    setEditing(r);
    setOpen(true);
  };

  const onComplete = async (r: ReminderDto) => {
    await updateReminder.mutateAsync({ id: r.id, payload: { status: 'completed' } });
  };

  const onDelete = async (r: ReminderDto) => {
    await deleteReminder.mutateAsync(r.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xl font-semibold text-slate-900">My Reminders</div>
          <div className="mt-1 text-sm text-slate-500">Assigned reminders</div>
        </div>
        <button
          type="button"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          New Reminder
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {String((error as any)?.message || error)}
        </div>
      ) : null}

      {isLoading ? <div className="text-sm text-slate-500">Loading…</div> : null}

      <ReminderTable reminders={reminders} onEdit={onEdit} onComplete={onComplete} onDelete={onDelete} />

      <ReminderModal open={open} onClose={() => setOpen(false)} onSubmit={submit} initial={editing ?? undefined} />
    </div>
  );
}

