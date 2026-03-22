import apiClient from './client'
import type { Webhook, WebhookCreate, WebhookDelivery, WebhookUpdate } from '../types'

export const webhooksApi = {
  getWebhooks: async (): Promise<Webhook[]> => {
    const response = await apiClient.get<Webhook[]>('/webhooks/')
    return response.data
  },

  getWebhook: async (id: number): Promise<Webhook> => {
    const response = await apiClient.get<Webhook>(`/webhooks/${id}`)
    return response.data
  },

  createWebhook: async (data: WebhookCreate): Promise<Webhook> => {
    const response = await apiClient.post<Webhook>('/webhooks/', data)
    return response.data
  },

  updateWebhook: async (id: number, data: WebhookUpdate): Promise<Webhook> => {
    const response = await apiClient.patch<Webhook>(`/webhooks/${id}`, data)
    return response.data
  },

  deleteWebhook: async (id: number): Promise<void> => {
    await apiClient.delete(`/webhooks/${id}`)
  },

  testWebhook: async (id: number): Promise<void> => {
    await apiClient.post(`/webhooks/${id}/test`)
  },

  getDeliveries: async (id: number): Promise<WebhookDelivery[]> => {
    const response = await apiClient.get<WebhookDelivery[]>(`/webhooks/${id}/deliveries`)
    return response.data
  },

  getEvents: async (): Promise<string[]> => {
    const response = await apiClient.get<string[]>('/webhooks/events')
    return response.data
  },
}
