import { create } from 'zustand';

export type NotificationUiState = {
  bellOpen: boolean;
  setBellOpen: (open: boolean) => void;
};

export const useNotificationStore = create<NotificationUiState>((set) => ({
  bellOpen: false,
  setBellOpen: (open) => set({ bellOpen: open }),
}));

