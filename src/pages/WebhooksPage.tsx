import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { webhooksApi } from '../api/webhooks'
import type { Webhook, WebhookCreate, WebhookDelivery, WebhookUpdate } from '../types'
import Modal from '../components/Modal'

interface WebhookFormData {
  name: string
  url: string
  events: string[]
  secret: string
  is_active: boolean
}

function WebhookForm({
  webhook,
  availableEvents,
  onSuccess,
  onCancel,
}: {
  webhook?: Webhook
  availableEvents: string[]
  onSuccess: () => void
  onCancel: () => void
}) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<WebhookFormData>({
    defaultValues: {
      name: webhook?.name ?? '',
      url: webhook?.url ?? '',
      events: webhook?.events ?? [],
      secret: '',
      is_active: webhook?.is_active ?? true,
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: WebhookCreate) => webhooksApi.createWebhook(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['webhooks'] }); onSuccess() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: WebhookUpdate }) => webhooksApi.updateWebhook(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['webhooks'] }); onSuccess() },
  })

  const onSubmit = async (data: WebhookFormData) => {
    const payload: WebhookCreate = {
      name: data.name,
      url: data.url,
      events: data.events,
      is_active: data.is_active,
    }
    if (data.secret) payload.secret = data.secret

    if (webhook) {
      await updateMutation.mutateAsync({ id: webhook.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
        <input
          {...register('name', { required: 'Name is required' })}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="My webhook"
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">URL *</label>
        <input
          {...register('url', { required: 'URL is required' })}
          type="url"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="https://example.com/webhook"
        />
        {errors.url && <p className="mt-1 text-xs text-red-600">{errors.url.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Secret (optional)</label>
        <input
          {...register('secret')}
          type="password"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder={webhook ? 'Leave blank to keep existing' : 'Webhook secret for signature verification'}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Events *</label>
        <Controller
          name="events"
          control={control}
          rules={{ validate: (v) => v.length > 0 || 'Select at least one event' }}
          render={({ field }) => (
            <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3">
              {availableEvents.map((event) => {
                const isSelected = field.value.includes(event)
                return (
                  <label key={event} className="flex items-center gap-2 cursor-pointer hover:text-slate-900">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        if (isSelected) {
                          field.onChange(field.value.filter((e) => e !== event))
                        } else {
                          field.onChange([...field.value, event])
                        }
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-600 font-mono">{event}</span>
                  </label>
                )
              })}
            </div>
          )}
        />
        {errors.events && <p className="mt-1 text-xs text-red-600">{errors.events.message}</p>}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_active"
          {...register('is_active')}
          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        <label htmlFor="is_active" className="text-sm font-medium text-slate-700">Active</label>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60">
          {isSubmitting ? 'Saving...' : webhook ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  )
}

function DeliveriesPanel({ webhook, onClose }: { webhook: Webhook; onClose: () => void }) {
  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ['webhook-deliveries', webhook.id],
    queryFn: () => webhooksApi.getDeliveries(webhook.id),
  })

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-slate-200 flex flex-col z-40">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <div>
          <h3 className="font-semibold text-slate-900">Delivery History</h3>
          <p className="text-xs text-slate-500">{webhook.name}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
          </div>
        ) : deliveries.length === 0 ? (
          <div className="text-center py-12 px-6">
            <p className="text-slate-500 font-medium">No deliveries yet</p>
            <p className="text-slate-400 text-sm mt-1">Deliveries will appear here after events are triggered</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {deliveries.map((delivery: WebhookDelivery) => (
              <DeliveryItem key={delivery.id} delivery={delivery} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DeliveryItem({ delivery }: { delivery: WebhookDelivery }) {
  const [isExpanded, setIsExpanded] = useState(false)
  return (
    <div className="px-6 py-4">
      <div
        className="flex items-start gap-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${delivery.success ? 'bg-green-500' : 'bg-red-500'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono text-slate-700 truncate">{delivery.event_type}</span>
            {delivery.response_status && (
              <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                delivery.response_status >= 200 && delivery.response_status < 300
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {delivery.response_status}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {new Date(delivery.created_at).toLocaleString()} · {delivery.attempt_count} attempt{delivery.attempt_count !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
      {isExpanded && (
        <div className="mt-3 space-y-2">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Payload</p>
            <pre className="text-xs bg-slate-50 rounded p-2 overflow-x-auto text-slate-700 max-h-24">
              {JSON.stringify(delivery.payload, null, 2)}
            </pre>
          </div>
          {delivery.response_body && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Response</p>
              <pre className="text-xs bg-slate-50 rounded p-2 overflow-x-auto text-slate-700 max-h-24">
                {delivery.response_body}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function WebhooksPage() {
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Webhook | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [viewingDeliveries, setViewingDeliveries] = useState<Webhook | null>(null)

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: webhooksApi.getWebhooks,
  })

  const { data: availableEvents = [] } = useQuery({
    queryKey: ['webhook-events'],
    queryFn: webhooksApi.getEvents,
  })

  const deleteMutation = useMutation({
    mutationFn: webhooksApi.deleteWebhook,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['webhooks'] }); setDeletingId(null) },
  })

  const testMutation = useMutation({
    mutationFn: webhooksApi.testWebhook,
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Webhooks</h1>
          <p className="text-sm text-slate-500 mt-0.5">Receive real-time event notifications</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Webhook
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <p className="text-slate-500 font-medium">No webhooks yet</p>
          <p className="text-slate-400 text-sm mt-1">Create a webhook to receive event notifications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <div key={webhook.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium text-slate-900">{webhook.name}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      webhook.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {webhook.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1 font-mono truncate">{webhook.url}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {webhook.events.map((event) => (
                      <span key={event} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-slate-100 text-slate-600">
                        {event}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setViewingDeliveries(webhook)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Deliveries
                  </button>
                  <button
                    onClick={() => testMutation.mutate(webhook.id)}
                    disabled={testMutation.isPending}
                    className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-60"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => setEditingItem(webhook)}
                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeletingId(webhook.id)}
                    className="text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deliveries side panel */}
      {viewingDeliveries && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-30"
            onClick={() => setViewingDeliveries(null)}
          />
          <DeliveriesPanel webhook={viewingDeliveries} onClose={() => setViewingDeliveries(null)} />
        </>
      )}

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New Webhook" size="lg">
        <WebhookForm
          availableEvents={availableEvents}
          onSuccess={() => setIsCreateOpen(false)}
          onCancel={() => setIsCreateOpen(false)}
        />
      </Modal>

      <Modal isOpen={!!editingItem} onClose={() => setEditingItem(null)} title="Edit Webhook" size="lg">
        {editingItem && (
          <WebhookForm
            webhook={editingItem}
            availableEvents={availableEvents}
            onSuccess={() => setEditingItem(null)}
            onCancel={() => setEditingItem(null)}
          />
        )}
      </Modal>

      <Modal isOpen={deletingId !== null} onClose={() => setDeletingId(null)} title="Delete Webhook" size="sm">
        <p className="text-slate-600 mb-4">Are you sure you want to delete this webhook?</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeletingId(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={() => deletingId !== null && deleteMutation.mutate(deletingId)}
            disabled={deleteMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60"
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
