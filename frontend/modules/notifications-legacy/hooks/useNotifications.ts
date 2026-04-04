import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '../services/notificationApi';

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await notificationApi.list()).data,
  });
}

export function useUnreadNotifications() {
  return useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => (await notificationApi.unread()).data,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationApi.markRead,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['notifications'] });
      await qc.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    },
  });
}

