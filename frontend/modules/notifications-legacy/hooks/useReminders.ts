import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reminderApi } from '../services/reminderApi';

export function useReminders() {
  return useQuery({
    queryKey: ['reminders'],
    queryFn: async () => (await reminderApi.list()).data,
  });
}

export function useCreateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reminderApi.create,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}

export function useUpdateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; payload: any }) => reminderApi.update(args.id, args.payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}

export function useDeleteReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reminderApi.remove,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}

