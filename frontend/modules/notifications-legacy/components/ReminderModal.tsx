import React, { useEffect, useMemo, useState } from 'react';
import type { CreateReminderPayload, ReminderDto } from '../services/reminderApi';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateReminderPayload) => Promise<void>;
  initial?: Partial<ReminderDto>;
};

const MODULES = ['CRM', 'Properties', 'Finance', 'Construction', 'HR', 'Tenant Portal'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const CHANNELS = ['system', 'email', 'sms', 'whatsapp'] as const;

export function ReminderModal({ open, onClose, onSubmit, initial }: Props) {
  const init = useMemo(() => {
    const now = new Date();
    const yyyyMmDd = now.toISOString().slice(0, 10);
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return {
      title: initial?.title ?? '',
      description: initial?.description ?? '',
      module_name: initial?.module_name ?? 'CRM',
      record_id: initial?.record_id ?? '',
      assigned_to_user: initial?.assigned_to_user ?? '',
      reminder_date: initial?.reminder_date ?? yyyyMmDd,
      reminder_time: initial?.reminder_time?.slice(0, 5) ?? `${hh}:${mm}`,
      priority: initial?.priority ?? 'medium',
      notification_channel: 'system' as const,
    };
  }, [initial]);

  const [form, setForm] = useState(init);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setForm(init);
  }, [open, init]);

  if (!open) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await onSubmit({
        title: form.title,
        description: form.description || null,
        module_name: form.module_name,
        record_id: form.record_id,
        assigned_to_user: form.assigned_to_user,
        reminder_date: form.reminder_date,
        reminder_time: form.reminder_time,
        priority: form.priority,
        notification_channel: form.notification_channel,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="text-base font-semibold text-slate-900">Create Reminder</div>
          <button type="button" className="text-sm text-slate-500 hover:text-slate-700" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600">Title</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.title}
              onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600">Description</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600">Module</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.module_name}
                onChange={(e) => setForm((s) => ({ ...s, module_name: e.target.value }))}
              >
                {MODULES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600">Related Record</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.record_id}
                onChange={(e) => setForm((s) => ({ ...s, record_id: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600">Reminder Date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.reminder_date}
                onChange={(e) => setForm((s) => ({ ...s, reminder_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600">Reminder Time</label>
              <input
                type="time"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.reminder_time}
                onChange={(e) => setForm((s) => ({ ...s, reminder_time: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600">Priority</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.priority}
                onChange={(e) => setForm((s) => ({ ...s, priority: e.target.value }))}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600">Notification Channel</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.notification_channel}
                onChange={(e) => setForm((s) => ({ ...s, notification_channel: e.target.value as any }))}
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600">Assigned To (User ID)</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.assigned_to_user}
              onChange={(e) => setForm((s) => ({ ...s, assigned_to_user: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            onClick={submit}
            disabled={busy || !form.title || !form.record_id || !form.assigned_to_user}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

