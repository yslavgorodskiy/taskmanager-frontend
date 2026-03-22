import apiClient from './client'
import type { AuthTokens, LoginRequest, RegisterRequest, User } from '../types'

export const authApi = {
  login: async (data: LoginRequest): Promise<AuthTokens> => {
    const response = await apiClient.post<AuthTokens>('/auth/login', data)
    return response.data
  },

  register: async (data: RegisterRequest): Promise<User> => {
    const response = await apiClient.post<User>('/auth/register', data)
    return response.data
  },

  refresh: async (refreshToken: string): Promise<AuthTokens> => {
    const response = await apiClient.post<AuthTokens>('/auth/refresh', {
      refresh_token: refreshToken,
    })
    return response.data
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<User>('/users/me')
    return response.data
  },

  updateMe: async (data: { full_name?: string; password?: string }): Promise<User> => {
    const response = await apiClient.patch<User>('/users/me', data)
    return response.data
  },
}
