import apiClient from './client'
import type { Tag, TagCreate } from '../types'

export const tagsApi = {
  getTags: async (): Promise<Tag[]> => {
    const response = await apiClient.get<Tag[]>('/tags/')
    return response.data
  },

  createTag: async (data: TagCreate): Promise<Tag> => {
    const response = await apiClient.post<Tag>('/tags/', data)
    return response.data
  },

  updateTag: async (id: number, data: Partial<TagCreate>): Promise<Tag> => {
    const response = await apiClient.patch<Tag>(`/tags/${id}`, data)
    return response.data
  },

  deleteTag: async (id: number): Promise<void> => {
    await apiClient.delete(`/tags/${id}`)
  },
}
