import React from 'react';
import type { ReminderDto } from '../services/reminderApi';

type Props = {
  reminders: ReminderDto[];
  onEdit?: (reminder: ReminderDto) => void;
  onComplete?: (reminder: ReminderDto) => void;
  onDelete?: (reminder: ReminderDto) => void;
};

export function ReminderTable({ reminders, onEdit, onComplete, onDelete }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
          <tr>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Module</th>
            <th className="px-4 py-3">Record ID</th>
            <th className="px-4 py-3">Reminder Date</th>
            <th className="px-4 py-3">Assigned To</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {reminders.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{r.title}</td>
              <td className="px-4 py-3 text-slate-600">{r.module_name}</td>
              <td className="px-4 py-3 text-slate-600">{r.record_id}</td>
              <td className="px-4 py-3 text-slate-600">
                {r.reminder_date} {r.reminder_time}
              </td>
              <td className="px-4 py-3 text-slate-600">{r.assigned_to_user}</td>
              <td className="px-4 py-3 text-slate-600">{r.priority}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {r.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  {onEdit ? (
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => onEdit(r)}
                    >
                      Edit
                    </button>
                  ) : null}
                  {onComplete ? (
                    <button
                      type="button"
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      onClick={() => onComplete(r)}
                      disabled={r.status !== 'pending'}
                    >
                      Complete
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button
                      type="button"
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                      onClick={() => onDelete(r)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
          {reminders.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                No reminders found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

