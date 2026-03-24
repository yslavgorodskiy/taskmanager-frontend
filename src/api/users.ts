import { apiClient } from './client'
import type { ColumnSettings } from '../types'

export const usersApi = {
  getColumnSettings: async (): Promise<ColumnSettings | null> => {
    const { data } = await apiClient.get('/users/me/column-settings')
    return data
  },

  saveColumnSettings: async (settings: ColumnSettings): Promise<ColumnSettings> => {
    const { data } = await apiClient.put('/users/me/column-settings', settings)
    return data
  },
}
