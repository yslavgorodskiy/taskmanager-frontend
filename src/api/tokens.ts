import apiClient from './client'
import type { APIToken, APITokenCreated } from '../types'

export const tokensApi = {
  getTokens: async (): Promise<APIToken[]> => {
    const response = await apiClient.get<APIToken[]>('/api-tokens/')
    return response.data
  },

  createToken: async (data: { name: string; expires_at?: string }): Promise<APITokenCreated> => {
    const response = await apiClient.post<APITokenCreated>('/api-tokens/', data)
    return response.data
  },

  revokeToken: async (id: number): Promise<void> => {
    await apiClient.post(`/api-tokens/${id}/revoke`)
  },

  deleteToken: async (id: number): Promise<void> => {
    await apiClient.delete(`/api-tokens/${id}`)
  },
}
