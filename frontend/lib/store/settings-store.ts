import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiService } from '../api';

interface Currency {
  code: string;
  symbol: string;
  exchangeRate: number;
}

interface SettingsState {
  // Branding Fields
  companyName: string;
  companyEmail: string | null;
  supportPhone: string | null;
  companyAddress: string | null;
  companyLogo: string | null;
  selectedCurrency: string;
  // JSON Configs
  notificationConfig: any;
  integrationConfig: any;
  
  currencies: Currency[];
  activeCurrency: string;
  numberFormat: 'full' | 'compact';
  isLoading: boolean;
  isInitialized: boolean;
  
  initialize: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  fetchCurrencies: () => Promise<void>;
  setActiveCurrency: (code: string) => void;
  setNumberFormat: (format: 'full' | 'compact') => void;
  updateBranding: (data: Partial<SettingsState>) => Promise<void>;
  updateConfig: (key: 'notificationConfig' | 'integrationConfig', value: any) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      companyName: '',
      companyEmail: null,
      supportPhone: null,
      companyAddress: null,
      companyLogo: null,
      selectedCurrency: 'PKR',

      notificationConfig: {},
      integrationConfig: {},
      currencies: [],
      activeCurrency: 'PKR',
      numberFormat: 'full',
      isLoading: false,
      isInitialized: false,

      initialize: async () => {
        if (get().isInitialized) return;
        await Promise.all([get().fetchSettings(), get().fetchCurrencies()]);
        set({ isInitialized: true });
      },

      fetchSettings: async () => {
        set({ isLoading: true });
        try {
          const response = await apiService.settings.getAll();
          const { 
            companyName, 
            companyEmail, 
            supportPhone, 
            companyAddress,
            companyLogo,
            selectedCurrency,
            notificationConfig,
            integrationConfig
          } = response.data;

          set({ 
            companyName, 
            companyEmail, 
            supportPhone, 
            companyAddress, 
            companyLogo,
            selectedCurrency: selectedCurrency || 'PKR',
            activeCurrency: selectedCurrency || get().activeCurrency || 'PKR',
            notificationConfig: notificationConfig || {},
            integrationConfig: integrationConfig || {}
          });
        } catch (error) {
          console.error('Failed to fetch settings:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      fetchCurrencies: async () => {
        try {
          const response = await apiService.currencies.getAllActive();
          set({ currencies: response.data });
        } catch (error) {
          console.error('Failed to fetch currencies:', error);
        }
      },

      setActiveCurrency: (code) => {
        set({ activeCurrency: code });
      },

      setNumberFormat: (format) => {
        set({ numberFormat: format });
      },

      updateBranding: async (data) => {
        try {
          await apiService.put('/settings', data);
          set((state) => ({ ...state, ...data }));
        } catch (error) {
          console.error('Failed to update branding settings:', error);
          throw error;
        }
      },

      updateConfig: async (key, value) => {
        try {
          const data = { [key]: value };
          await apiService.put('/settings', data);
          set((state) => ({
            ...state,
            [key]: value
          }));
        } catch (error) {
          console.error(`Failed to update config ${key}:`, error);
          throw error;
        }
      },
    }),
    {
      name: 'rems-settings-storage',
      partialize: (state) => ({ 
        activeCurrency: state.activeCurrency, 
        numberFormat: state.numberFormat 
      }),
    }
  )
);
