export type TaskStatus = 'new' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Task {
  id: number
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  due_date?: string
  direction?: Direction
  tags: Tag[]
  owner_id: number
  created_at: string
  updated_at?: string
}

export interface Direction {
  id: number
  name: string
  color?: string
  owner_id: number
  created_at: string
}

export interface Tag {
  id: number
  name: string
  color?: string
  owner_id: number
  created_at: string
}

export interface Webhook {
  id: number
  name: string
  url: string
  events: string[]
  secret: string
  is_active: boolean
  owner_id: number
  created_at: string
}

export interface WebhookDelivery {
  id: number
  webhook_id: number
  event_type: string
  payload: object
  response_status?: number
  response_body?: string
  attempt_count: number
  success: boolean
  created_at: string
}

export interface APIToken {
  id: number
  name: string
  prefix: string
  is_active: boolean
  expires_at?: string
  created_at: string
  last_used_at?: string
}

export interface APITokenCreated extends APIToken {
  token: string
}

export interface User {
  id: number
  email: string
  full_name?: string
  is_active: boolean
  is_superuser: boolean
  created_at: string
}

export interface TaskCreate {
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  due_date?: string
  direction_id?: number
  tag_ids?: number[]
}

export interface TaskUpdate {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  due_date?: string
  direction_id?: number | null
  tag_ids?: number[]
}

export interface DirectionCreate {
  name: string
  color?: string
}

export interface TagCreate {
  name: string
  color?: string
}

export interface WebhookCreate {
  name: string
  url: string
  events: string[]
  secret?: string
  is_active?: boolean
}

export interface WebhookUpdate {
  name?: string
  url?: string
  events?: string[]
  secret?: string
  is_active?: boolean
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  full_name?: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface TaskFilters {
  status?: TaskStatus
  priority?: TaskPriority
  direction_id?: number
  tag_ids?: number[]
}

export interface ColumnWidthConfig {
  minWidth?: number
  maxWidth?: number
}

export interface ColumnSettings {
  visible: string[]
  widths: Record<string, ColumnWidthConfig>
}

export interface SavedView {
  id: number
  name: string
  settings: SavedViewSettings
  owner_id: number
  created_at: string
  updated_at?: string
}

export interface SavedViewSettings {
  visible: string[]
  widths: Record<string, ColumnWidthConfig>
  liveWidths?: Record<string, number>
  filters: { field: string; op: string; value: string }[]
  filterExpression: string
  sortKey: string | null
  sortOrder: 'asc' | 'desc'
  sortKeys?: { key: string; order: 'asc' | 'desc' }[]
  searchQuery: string
}
