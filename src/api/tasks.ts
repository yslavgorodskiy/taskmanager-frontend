import apiClient from './client'
import type { Task, TaskCreate, TaskFilters, TaskUpdate } from '../types'

export const tasksApi = {
  getTasks: async (filters?: TaskFilters): Promise<Task[]> => {
    const params: Record<string, string> = {}
    if (filters?.status) params.status = filters.status
    if (filters?.priority) params.priority = filters.priority
    if (filters?.direction_id) params.direction_id = String(filters.direction_id)
    if (filters?.tag_ids && filters.tag_ids.length > 0) {
      params.tag_ids = filters.tag_ids.join(',')
    }
    const response = await apiClient.get<Task[]>('/tasks/', { params })
    return response.data
  },

  createTask: async (data: TaskCreate): Promise<Task> => {
    const response = await apiClient.post<Task>('/tasks/', data)
    return response.data
  },

  updateTask: async (id: number, data: TaskUpdate): Promise<Task> => {
    const response = await apiClient.patch<Task>(`/tasks/${id}`, data)
    return response.data
  },

  deleteTask: async (id: number): Promise<void> => {
    await apiClient.delete(`/tasks/${id}`)
  },
}
