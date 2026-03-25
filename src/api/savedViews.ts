import { apiClient } from './client'
import type { SavedView, SavedViewSettings } from '../types'

export const savedViewsApi = {
  list: async (): Promise<SavedView[]> => {
    const { data } = await apiClient.get('/saved-views/')
    return data
  },

  create: async (name: string, settings: SavedViewSettings): Promise<SavedView> => {
    const { data } = await apiClient.post('/saved-views/', { name, settings })
    return data
  },

  update: async (id: number, settings: SavedViewSettings): Promise<SavedView> => {
    const { data } = await apiClient.patch(`/saved-views/${id}`, { settings })
    return data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/saved-views/${id}`)
  },
}
