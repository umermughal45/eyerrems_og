import React, { useMemo } from 'react';
import { Bell } from 'lucide-react';
import { useUnreadNotifications, useMarkNotificationsRead } from '../hooks/useNotifications';
import { useNotificationStore, type NotificationUiState } from '../store/notificationStore';
import { NotificationDropdown } from './NotificationDropdown';
import type { NotificationDto } from '../services/notificationApi';

export function NotificationBell() {
  const { data: unread = [] } = useUnreadNotifications();
  const markRead = useMarkNotificationsRead();
  const bellOpen = useNotificationStore((s: NotificationUiState) => s.bellOpen);
  const setBellOpen = useNotificationStore((s: NotificationUiState) => s.setBellOpen);

  const unreadCount = unread.length;
  const recent = useMemo<NotificationDto[]>(() => unread.slice(0, 10), [unread]);

  const onMarkAllRead = async () => {
    if (unreadCount === 0) return;
    await markRead.mutateAsync(unread.map((n: NotificationDto) => n.id));
  };

  const onMarkRead = async (id: string) => {
    await markRead.mutateAsync([id]);
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100"
        onClick={() => setBellOpen(!bellOpen)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-slate-700" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {bellOpen ? (
        <NotificationDropdown
          notifications={recent}
          onClose={() => setBellOpen(false)}
          onMarkAllRead={onMarkAllRead}
          onMarkRead={onMarkRead}
        />
      ) : null}
    </div>
  );
}

