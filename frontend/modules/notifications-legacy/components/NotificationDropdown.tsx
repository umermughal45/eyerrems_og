import React from 'react';
import type { NotificationDto } from '../services/notificationApi';

type Props = {
  notifications: NotificationDto[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
};

export function NotificationDropdown({ notifications, onClose, onMarkAllRead, onMarkRead }: Props) {
  return (
    <div className="absolute right-0 mt-2 w-96 rounded-xl border border-slate-200 bg-white shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="text-sm font-semibold text-slate-900">Notifications</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
            onClick={onMarkAllRead}
          >
            Mark all read
          </button>
          <button type="button" className="text-xs text-slate-500 hover:text-slate-700" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="max-h-[420px] overflow-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">No new notifications.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <li key={n.id} className="px-4 py-3 hover:bg-slate-50">
                <button type="button" className="w-full text-left" onClick={() => onMarkRead(n.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                      <div className="mt-1 text-sm text-slate-600 line-clamp-2">{n.message}</div>
                      <div className="mt-2 text-xs text-slate-400">
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                    </div>
                    <span className="mt-1 h-2 w-2 rounded-full bg-indigo-600" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

