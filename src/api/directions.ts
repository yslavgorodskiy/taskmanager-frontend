import apiClient from './client'
import type { Direction, DirectionCreate } from '../types'

export const directionsApi = {
  getDirections: async (): Promise<Direction[]> => {
    const response = await apiClient.get<Direction[]>('/directions/')
    return response.data
  },

  getDirection: async (id: number): Promise<Direction> => {
    const response = await apiClient.get<Direction>(`/directions/${id}`)
    return response.data
  },

  createDirection: async (data: DirectionCreate): Promise<Direction> => {
    const response = await apiClient.post<Direction>('/directions/', data)
    return response.data
  },

  updateDirection: async (id: number, data: Partial<DirectionCreate>): Promise<Direction> => {
    const response = await apiClient.patch<Direction>(`/directions/${id}`, data)
    return response.data
  },

  deleteDirection: async (id: number): Promise<void> => {
    await apiClient.delete(`/directions/${id}`)
  },
}
