import { create } from 'zustand'

export interface SystemSettings {
  float_precision: number
  currency_precision: number
  date_format?: string
  time_format?: string
  number_format?: string
  country?: string
  language?: string
  time_zone?: string
}

interface SystemSettingsStore {
  settings: SystemSettings | null
  setSettings: (settings: SystemSettings) => void
  fetchSettings: () => Promise<void>
}

export const useSystemSettingsStore = create<SystemSettingsStore>((set) => ({
  settings: null,
  setSettings: (settings) => set({ settings }),
  fetchSettings: async () => {
    try {
      const response = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.settings.get_system_settings',
        method: 'GET'
      })
      if (response?.data?.data) {
        set({
          settings: {
            ...response.data.data,
            float_precision: Number(response.data.data.float_precision || 3),
            currency_precision: Number(response.data.data.currency_precision || 2)
          }
        })
      }
    } catch (e) {
      console.error('Failed to fetch system settings', e)
    }
  }
}))
