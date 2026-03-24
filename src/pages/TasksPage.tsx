import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { tasksApi } from '../api/tasks'
import { directionsApi } from '../api/directions'
import { tagsApi } from '../api/tags'
import { usersApi } from '../api/users'
import type { Task, TaskCreate, TaskStatus, TaskPriority, TaskUpdate, ColumnSettings, Direction, Tag } from '../types'
import Modal from '../components/Modal'

// ─── Column types ────────────────────────────────────────────────────────────

type ColumnKey = 'title' | 'status' | 'priority' | 'direction' | 'due_date'
type SortKey = ColumnKey
type SortOrder = 'asc' | 'desc'
type ColumnWidths = ColumnSettings['widths']

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'title', label: 'Назва' },
  { key: 'status', label: 'Статус' },
  { key: 'priority', label: 'Пріоритет' },
  { key: 'direction', label: 'Напрямок' },
  { key: 'due_date', label: 'Дедлайн' },
]

const ALL_COLUMN_KEYS: ColumnKey[] = COLUMNS.map((c) => c.key)
const DEFAULT_SETTINGS: ColumnSettings = { visible: ['title'], widths: {} }

function colFixedWidth(key: ColumnKey, widths: ColumnWidths): number | undefined {
  const w = widths[key]
  if (!w) return undefined
  if (w.maxWidth) return w.maxWidth
  if (w.minWidth) return w.minWidth
  return undefined
}

const STATUS_ORDER: Record<TaskStatus, number> = { new: 0, in_progress: 1, completed: 2, cancelled: 3 }
const PRIORITY_ORDER: Record<TaskPriority, number> = { low: 0, medium: 1, high: 2, urgent: 3 }

// ─── Advanced filter types ───────────────────────────────────────────────────

type FilterFieldType = 'string' | 'enum' | 'relation' | 'date'

interface FilterFieldDef {
  key: string
  label: string
  type: FilterFieldType
  options?: { value: string; label: string }[]
}

type FilterOp = 'contains' | 'not_contains' | 'equals' | 'not_equals' | 'empty' | 'not_empty' | 'before' | 'after'

interface FilterRule {
  field: string
  op: FilterOp
  value: string
}

const OPS_BY_TYPE: Record<FilterFieldType, { value: FilterOp; label: string }[]> = {
  string: [
    { value: 'contains', label: 'містить' },
    { value: 'not_contains', label: 'не містить' },
    { value: 'equals', label: 'дорівнює' },
    { value: 'not_equals', label: 'не дорівнює' },
    { value: 'empty', label: 'порожнє' },
    { value: 'not_empty', label: 'не порожнє' },
  ],
  enum: [
    { value: 'equals', label: 'дорівнює' },
    { value: 'not_equals', label: 'не дорівнює' },
  ],
  relation: [
    { value: 'equals', label: 'дорівнює' },
    { value: 'not_equals', label: 'не дорівнює' },
    { value: 'empty', label: 'порожнє' },
    { value: 'not_empty', label: 'не порожнє' },
  ],
  date: [
    { value: 'equals', label: 'дорівнює' },
    { value: 'before', label: 'до' },
    { value: 'after', label: 'після' },
    { value: 'empty', label: 'порожнє' },
    { value: 'not_empty', label: 'не порожнє' },
  ],
}

const NO_VALUE_OPS: FilterOp[] = ['empty', 'not_empty']

const DATE_PRESETS: { value: string; label: string }[] = [
  { value: '$today', label: 'Поточна дата' },
  { value: '$week_start', label: 'Початок цього тижня' },
  { value: '$month_start', label: 'Початок цього місяця' },
  { value: '$year_start', label: 'Початок цього року' },
]

function resolveDateValue(value: string): string {
  const now = new Date()
  switch (value) {
    case '$today':
      return now.toISOString().split('T')[0]
    case '$week_start': {
      const d = new Date(now)
      const day = d.getDay()
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)) // Monday
      return d.toISOString().split('T')[0]
    }
    case '$month_start':
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    case '$year_start':
      return `${now.getFullYear()}-01-01`
    default:
      return value
  }
}

function getTaskFieldValue(task: Task, fieldKey: string): string | null {
  switch (fieldKey) {
    case 'title': return task.title
    case 'description': return task.description ?? null
    case 'status': return task.status
    case 'priority': return task.priority
    case 'direction': return task.direction?.name ?? null
    case 'direction_id': return task.direction ? String(task.direction.id) : null
    case 'due_date': return task.due_date ? task.due_date.split('T')[0] : null
    default: return null
  }
}

function evalFilterRule(task: Task, rule: FilterRule, fieldDef: FilterFieldDef): boolean {
  const valKey = fieldDef.type === 'relation' && (rule.op === 'equals' || rule.op === 'not_equals')
    ? fieldDef.key + '_id'
    : fieldDef.key
  const raw = getTaskFieldValue(task, valKey)
  const ruleValue = fieldDef.type === 'date' ? resolveDateValue(rule.value) : rule.value

  switch (rule.op) {
    case 'empty': return raw === null || raw === ''
    case 'not_empty': return raw !== null && raw !== ''
    case 'contains': return (raw ?? '').toLowerCase().includes(ruleValue.toLowerCase())
    case 'not_contains': return !(raw ?? '').toLowerCase().includes(ruleValue.toLowerCase())
    case 'equals':
      if (fieldDef.type === 'relation') return raw === ruleValue
      return (raw ?? '') === ruleValue
    case 'not_equals':
      if (fieldDef.type === 'relation') return raw !== ruleValue
      return (raw ?? '') !== ruleValue
    case 'before': return raw != null && raw < ruleValue
    case 'after': return raw != null && raw > ruleValue
  }
}

// ─── Expression parser for "(1 та 2) або 3" ─────────────────────────────────

type ExprNode = { type: 'ref'; index: number }
  | { type: 'and'; left: ExprNode; right: ExprNode }
  | { type: 'or'; left: ExprNode; right: ExprNode }

function parseFilterExpression(expr: string): ExprNode | null {
  const tokens: string[] = []
  const re = /\(|\)|\d+|та|або|and|or/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(expr)) !== null) tokens.push(m[0])
  if (tokens.length === 0) return null

  let pos = 0

  function peek() { return tokens[pos] }
  function consume() { return tokens[pos++] }

  function parseExpr(): ExprNode | null {
    let left = parseTerm()
    if (!left) return null
    while (peek() === 'або' || peek()?.toLowerCase() === 'or') {
      consume()
      const right = parseTerm()
      if (!right) return null
      left = { type: 'or', left, right }
    }
    return left
  }

  function parseTerm(): ExprNode | null {
    let left = parsePrimary()
    if (!left) return null
    while (peek() === 'та' || peek()?.toLowerCase() === 'and') {
      consume()
      const right = parsePrimary()
      if (!right) return null
      left = { type: 'and', left, right }
    }
    return left
  }

  function parsePrimary(): ExprNode | null {
    const t = peek()
    if (!t) return null
    if (t === '(') {
      consume()
      const node = parseExpr()
      if (peek() === ')') consume()
      return node
    }
    if (/^\d+$/.test(t)) {
      consume()
      return { type: 'ref', index: Number(t) }
    }
    return null
  }

  return parseExpr()
}

function evalExpr(node: ExprNode, results: Map<number, boolean>): boolean {
  switch (node.type) {
    case 'ref': return results.get(node.index) ?? true
    case 'and': return evalExpr(node.left, results) && evalExpr(node.right, results)
    case 'or': return evalExpr(node.left, results) || evalExpr(node.right, results)
  }
}

function applyAdvancedFilters(
  task: Task,
  filters: FilterRule[],
  expression: string,
  fieldDefs: FilterFieldDef[],
): boolean {
  if (filters.length === 0) return true
  const defMap = new Map(fieldDefs.map((d) => [d.key, d]))
  const results = new Map<number, boolean>()
  filters.forEach((f, i) => {
    const fd = defMap.get(f.field)
    results.set(i + 1, fd ? evalFilterRule(task, f, fd) : true)
  })
  const ast = parseFilterExpression(expression.trim())
  if (ast) return evalExpr(ast, results)
  // Default: AND all filters
  for (const v of results.values()) if (!v) return false
  return true
}

// Ukrainian labels
const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'new', label: 'Нове' },
  { value: 'in_progress', label: 'В роботі' },
  { value: 'completed', label: 'Завершено' },
  { value: 'cancelled', label: 'Скасовано' },
]

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Низький' },
  { value: 'medium', label: 'Середній' },
  { value: 'high', label: 'Високий' },
  { value: 'urgent', label: 'Терміново' },
]

const STATUS_STYLES: Record<TaskStatus, string> = {
  new: 'bg-blue-100 text-blue-700 border border-blue-200',
  in_progress: 'bg-amber-100 text-amber-700 border border-amber-200',
  completed: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  cancelled: 'bg-slate-100 text-slate-500 border border-slate-200',
}

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: 'bg-teal-100 text-teal-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

// Avatar colors for variety
const AVATAR_COLORS = ['bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-sky-500', 'bg-indigo-500']

interface TaskFormData {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  due_date: string
  direction_id: string
  tag_ids: string[]
}

function TaskForm({
  task,
  onSuccess,
  onCancel,
}: {
  task?: Task
  onSuccess: () => void
  onCancel: () => void
}) {
  const queryClient = useQueryClient()
  const { data: directions = [] } = useQuery({ queryKey: ['directions'], queryFn: directionsApi.getDirections })
  const { data: tags = [] } = useQuery({ queryKey: ['tags'], queryFn: tagsApi.getTags })

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<TaskFormData>({
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      status: task?.status ?? 'new',
      priority: task?.priority ?? 'medium',
      due_date: task?.due_date ? task.due_date.split('T')[0] : '',
      direction_id: task?.direction?.id ? String(task.direction.id) : '',
      tag_ids: task?.tags.map((t) => String(t.id)) ?? [],
    },
  })

  const createMutation = useMutation({
    mutationFn: tasksApi.createTask,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); onSuccess() },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TaskUpdate }) => tasksApi.updateTask(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); onSuccess() },
  })

  const onSubmit = async (data: TaskFormData) => {
    const payload = {
      title: data.title,
      description: data.description || undefined,
      status: data.status,
      priority: data.priority,
      due_date: data.due_date || undefined,
      direction_id: data.direction_id ? Number(data.direction_id) : undefined,
      tag_ids: data.tag_ids.map(Number),
    }
    if (task) {
      await updateMutation.mutateAsync({ id: task.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload as TaskCreate)
    }
  }

  const error = createMutation.error || updateMutation.error
  const apiError = error as { response?: { data?: { detail?: string } } } | null

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {apiError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {apiError.response?.data?.detail || 'Виникла помилка'}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Назва *</label>
        <input
          {...register('title', { required: "Назва обов'язкова" })}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Назва задачі"
        />
        {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Опис</label>
        <textarea
          {...register('description')}
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          placeholder="Необов'язковий опис"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Статус</label>
          <select {...register('status')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Пріоритет</label>
          <select {...register('priority')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {PRIORITY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Дедлайн</label>
        <input type="date" {...register('due_date')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Напрямок</label>
        <select {...register('direction_id')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">— Без напрямку —</option>
          {directions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Теги</label>
        <Controller
          name="tag_ids"
          control={control}
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const isSelected = field.value.includes(String(tag.id))
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        field.onChange(field.value.filter((v) => v !== String(tag.id)))
                      } else {
                        field.onChange([...field.value, String(tag.id)])
                      }
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      isSelected ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-slate-300 text-slate-600 hover:border-indigo-300'
                    }`}
                    style={tag.color && isSelected ? { backgroundColor: tag.color + '33', borderColor: tag.color, color: tag.color } : undefined}
                  >
                    {tag.name}
                  </button>
                )
              })}
              {tags.length === 0 && <p className="text-xs text-slate-400">Теги ще не створено</p>}
            </div>
          )}
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
          Скасувати
        </button>
        <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60">
          {isSubmitting ? 'Збереження...' : task ? 'Оновити задачу' : 'Створити задачу'}
        </button>
      </div>
    </form>
  )
}

export default function TasksPage() {
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Column settings from server
  const { data: savedSettings } = useQuery({
    queryKey: ['column-settings'],
    queryFn: usersApi.getColumnSettings,
  })

  const columnSettings: ColumnSettings = savedSettings ?? DEFAULT_SETTINGS

  const saveMutation = useMutation({
    mutationFn: usersApi.saveColumnSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['column-settings'], data)
    },
  })

  // Advanced filters
  const [advancedFilters, setAdvancedFilters] = useState<FilterRule[]>([])
  const [filterExpression, setFilterExpression] = useState('')

  // Settings modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'fields' | 'filters'>('fields')
  const [draftVisible, setDraftVisible] = useState<ColumnKey[]>([])
  const [draftWidths, setDraftWidths] = useState<ColumnWidths>({})
  const [draftFilters, setDraftFilters] = useState<FilterRule[]>([])
  const [draftExpression, setDraftExpression] = useState('')

  const openSettings = (tab: 'fields' | 'filters' = 'fields') => {
    setDraftVisible([...columnSettings.visible] as ColumnKey[])
    setDraftWidths(structuredClone(columnSettings.widths))
    setDraftFilters(advancedFilters.map((f) => ({ ...f })))
    setDraftExpression(filterExpression)
    setSettingsTab(tab)
    setIsSettingsOpen(true)
  }

  const openSettingsFilters = () => openSettings('filters')

  const toggleDraftColumn = (key: ColumnKey) => {
    setDraftVisible((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const setDraftWidth = (key: ColumnKey, field: 'minWidth' | 'maxWidth', value: string) => {
    const num = value === '' ? undefined : Number(value)
    setDraftWidths((prev) => {
      const entry = { ...prev[key] }
      entry[field] = num && num > 0 ? num : undefined
      return { ...prev, [key]: entry }
    })
  }

  const addDraftFilter = () => {
    const newIndex = draftFilters.length + 1
    setDraftFilters([...draftFilters, { field: 'title', op: 'contains', value: '' }])
    const trimmed = draftExpression.trim()
    if (newIndex === 1 || trimmed === '') {
      setDraftExpression(String(newIndex))
    } else {
      setDraftExpression(`${trimmed} та ${newIndex}`)
    }
  }

  const updateDraftFilter = (idx: number, patch: Partial<FilterRule>) => {
    setDraftFilters((prev) => prev.map((f, i) => {
      if (i !== idx) return f
      const updated = { ...f, ...patch }
      // Reset op/value when field type changes
      if (patch.field && patch.field !== f.field) {
        const newDef = FILTER_FIELDS.find((d) => d.key === patch.field)
        const ops = newDef ? OPS_BY_TYPE[newDef.type] : []
        updated.op = ops[0]?.value ?? 'equals'
        updated.value = ''
      }
      // Reset value when switching to empty/not_empty
      if (patch.op && NO_VALUE_OPS.includes(patch.op)) {
        updated.value = ''
      }
      return updated
    }))
  }

  const removeDraftFilter = (idx: number) => {
    const removedNum = idx + 1
    const next = draftFilters.filter((_, i) => i !== idx)
    setDraftFilters(next)

    if (next.length === 0) {
      setDraftExpression('')
    } else if (next.length === 1) {
      setDraftExpression('1')
    } else {
      // Tokenize expression, remove the deleted number + its adjacent operator, renumber
      const tokens: string[] = []
      const re = /\(|\)|\d+|та|або|and|or/gi
      let m: RegExpExecArray | null
      while ((m = re.exec(draftExpression)) !== null) tokens.push(m[0])

      // Find and remove the token for removedNum
      const numIdx = tokens.findIndex((t) => t === String(removedNum))
      if (numIdx !== -1) {
        // Remove adjacent operator (prefer the one before, fallback to after)
        const isOp = (t: string) => /^(та|або|and|or)$/i.test(t)
        if (numIdx > 0 && isOp(tokens[numIdx - 1])) {
          tokens.splice(numIdx - 1, 2) // remove operator + number
        } else if (numIdx < tokens.length - 1 && isOp(tokens[numIdx + 1])) {
          tokens.splice(numIdx, 2) // remove number + operator
        } else {
          tokens.splice(numIdx, 1) // remove just the number
        }
      }

      // Clean up empty parens: ( ) → remove both
      for (let i = tokens.length - 1; i >= 1; i--) {
        if (tokens[i] === ')' && tokens[i - 1] === '(') {
          tokens.splice(i - 1, 2)
          i--
        }
      }

      // Renumber: shift all numbers > removedNum down by 1
      const result = tokens.map((t) => {
        if (/^\d+$/.test(t)) {
          const n = Number(t)
          return n > removedNum ? String(n - 1) : t
        }
        return t
      }).join(' ')

      setDraftExpression(result)
    }
  }

  const applySettings = () => {
    const visible = draftVisible.length > 0 ? draftVisible : [...ALL_COLUMN_KEYS]
    const next: ColumnSettings = { visible, widths: draftWidths }
    saveMutation.mutate(next)
    setAdvancedFilters(draftFilters)
    setFilterExpression(draftExpression)
    setIsSettingsOpen(false)
  }

  const isVisible = (key: ColumnKey) => columnSettings.visible.includes(key)
  const visibleColCount = columnSettings.visible.length + 2 // +checkbox +actions

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortOrder === 'asc') setSortOrder('desc')
      else { setSortKey(null); setSortOrder('asc') }
    } else {
      setSortKey(key)
      setSortOrder('asc')
    }
  }

  // Filters
  const [searchQuery, setSearchQuery] = useState('')

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.getTasks({}),
  })

  const { data: directions = [] } = useQuery({
    queryKey: ['directions'],
    queryFn: directionsApi.getDirections,
  })

  const FILTER_FIELDS: FilterFieldDef[] = useMemo(() => [
    { key: 'title', label: 'Назва', type: 'string' },
    { key: 'description', label: 'Опис', type: 'string' },
    { key: 'status', label: 'Статус', type: 'enum', options: STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })) },
    { key: 'priority', label: 'Пріоритет', type: 'enum', options: PRIORITY_OPTIONS.map((o) => ({ value: o.value, label: o.label })) },
    { key: 'direction', label: 'Напрямок', type: 'relation', options: directions.map((d) => ({ value: String(d.id), label: d.name })) },
    { key: 'due_date', label: 'Дедлайн', type: 'date' },
  ], [directions])

  const deleteMutation = useMutation({
    mutationFn: tasksApi.deleteTask,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); setDeletingId(null) },
  })

  const rebuildExpression = (filters: FilterRule[]) => {
    if (filters.length === 0) return ''
    if (filters.length === 1) return '1'
    // Group same-field filters with "або", connect different groups with "та"
    const groups: number[][] = []
    const fieldToGroup = new Map<string, number>()
    filters.forEach((f, i) => {
      const existing = fieldToGroup.get(f.field)
      if (existing !== undefined) {
        groups[existing].push(i + 1)
      } else {
        fieldToGroup.set(f.field, groups.length)
        groups.push([i + 1])
      }
    })
    const parts = groups.map((nums) => {
      const inner = nums.join(' або ')
      return nums.length > 1 && groups.length > 1 ? `(${inner})` : inner
    })
    return parts.join(' та ')
  }

  const addOrRemoveSidebarFilter = (field: string, op: FilterOp, value: string) => {
    const existingIdx = advancedFilters.findIndex(
      (f) => f.field === field && f.op === op && f.value === value
    )
    if (existingIdx !== -1) {
      const next = advancedFilters.filter((_, i) => i !== existingIdx)
      setAdvancedFilters(next)
      setFilterExpression(rebuildExpression(next))
    } else {
      const next = [...advancedFilters, { field, op, value }]
      setAdvancedFilters(next)
      setFilterExpression(rebuildExpression(next))
    }
  }

  const toggleDirection = (id: number) => {
    addOrRemoveSidebarFilter('direction', 'equals', String(id))
  }

  const toggleStatus = (status: TaskStatus) => {
    addOrRemoveSidebarFilter('status', 'equals', status)
  }

  const filteredTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        if (!task.title.toLowerCase().includes(q) && !(task.description ?? '').toLowerCase().includes(q)) return false
      }
      if (!applyAdvancedFilters(task, advancedFilters, filterExpression, FILTER_FIELDS)) return false
      return true
    })

    if (!sortKey) return filtered

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'title':
          cmp = a.title.localeCompare(b.title, 'uk')
          break
        case 'status':
          cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
          break
        case 'priority':
          cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
          break
        case 'direction':
          cmp = (a.direction?.name ?? '').localeCompare(b.direction?.name ?? '', 'uk')
          break
        case 'due_date': {
          const da = a.due_date ? new Date(a.due_date).getTime() : Infinity
          const db = b.due_date ? new Date(b.due_date).getTime() : Infinity
          cmp = da - db
          break
        }
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

    return sorted
  }, [tasks, searchQuery, sortKey, sortOrder, advancedFilters, filterExpression, FILTER_FIELDS])

  const activeFiltersCount = advancedFilters.length

  const clearAllFilters = () => {
    setSearchQuery('')
    setAdvancedFilters([])
    setFilterExpression('')
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left filter panel */}
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 overflow-y-auto">
        <div className="flex-1 p-4 space-y-6">
          {/* Direction filter */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Напрямок</h3>
            {directions.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Немає напрямків</p>
            ) : (
              <div className="space-y-1.5">
                {directions.map((dir) => (
                  <label key={dir.id} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={advancedFilters.some((f) => f.field === 'direction' && f.op === 'equals' && f.value === String(dir.id))}
                      onChange={() => toggleDirection(dir.id)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="flex items-center gap-1.5 min-w-0">
                      {dir.color && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dir.color }} />
                      )}
                      <span className="text-sm text-slate-700 truncate group-hover:text-slate-900">{dir.name}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Status filter */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Статус</h3>
            <div className="space-y-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={advancedFilters.some((f) => f.field === 'status' && f.op === 'equals' && f.value === opt.value)}
                    onChange={() => toggleStatus(opt.value)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[opt.value]}`}>
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom link */}
        <div className="px-4 py-3 border-t border-slate-100">
          <button
            onClick={clearAllFilters}
            className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
          >
            Скинути фільтри
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-200 bg-white flex-shrink-0">
          {/* Create button */}
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-500 text-white text-sm font-medium rounded-md hover:bg-rose-600 transition-colors flex-shrink-0 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Створити
          </button>

          {/* Search */}
          <div className="relative flex-1">
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук задач..."
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Filter button */}
            <div className="flex items-center gap-1">
              <button
                onClick={openSettingsFilters}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeFiltersCount > 0
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                </svg>
                Фільтри
                {activeFiltersCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 bg-indigo-600 text-white rounded-full text-[10px] leading-none">{activeFiltersCount}</span>
                )}
              </button>
              {activeFiltersCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  title="Скинути всі фільтри"
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Record count */}
            <span className="text-xs text-slate-400 whitespace-nowrap">
              {filteredTasks.length} {filteredTasks.length === 1 ? 'запис' : 'записів'}
              {filteredTasks.length !== tasks.length && `, фільтр...`}
            </span>

            {/* Settings */}
            <button onClick={() => openSettings('fields')} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-600" />
            </div>
          ) : (
            <>
              <table className="w-full text-sm border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: 40 }} />
                  {COLUMNS.filter((col) => isVisible(col.key)).map((col) => {
                    const w = colFixedWidth(col.key, columnSettings.widths)
                    return <col key={col.key} style={w ? { width: w } : undefined} />
                  })}
                  <col style={{ width: 40 }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-2.5">
                      <input type="checkbox" className="w-3.5 h-3.5 rounded border-slate-300" />
                    </th>
                    {COLUMNS.filter((col) => isVisible(col.key)).map((col) => (
                      <th
                        key={col.key}
                        className={`text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:bg-slate-100 transition-colors overflow-hidden ${
                          sortKey === col.key ? 'text-indigo-600' : 'text-slate-500'
                        }`}
                        onClick={() => handleSort(col.key)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {sortKey === col.key ? (
                            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                              {sortOrder === 'asc'
                                ? <path d="M6 2l4 5H2z" />
                                : <path d="M6 10l4-5H2z" />}
                            </svg>
                          ) : (
                            <svg className="w-3 h-3 opacity-0 group-hover:opacity-30" viewBox="0 0 12 12" fill="currentColor">
                              <path d="M6 2l4 5H2z" />
                            </svg>
                          )}
                        </span>
                      </th>
                    ))}
                    <th className="px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={visibleColCount} className="text-center py-16 text-slate-400 text-sm">
                        {tasks.length === 0 ? 'Задач ще немає. Створіть першу!' : 'Нічого не знайдено за вашими фільтрами.'}
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((task, index) => {
                      const avatarColor = AVATAR_COLORS[task.id % AVATAR_COLORS.length]
                      const initials = task.title.slice(0, 2).toUpperCase()
                      return (
                        <tr
                          key={task.id}
                          className={`border-b border-slate-100 hover:bg-indigo-50/40 cursor-pointer transition-colors group ${
                            index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                          }`}
                          onClick={() => setEditingTask(task)}
                        >
                          {/* Checkbox */}
                          <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" className="w-3.5 h-3.5 rounded border-slate-300 cursor-pointer" />
                          </td>

                          {/* Title + avatar */}
                          {isVisible('title') && (
                            <td className="px-3 py-2.5 overflow-hidden">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-7 h-7 rounded-full ${avatarColor} flex items-center justify-center flex-shrink-0`}>
                                  <span className="text-xs font-semibold text-white">{initials}</span>
                                </div>
                                <div className="min-w-0 overflow-hidden">
                                  <p className="font-medium text-slate-800 truncate">{task.title}</p>
                                  {task.description && (
                                    <p className="text-xs text-slate-400 truncate">{task.description}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                          )}

                          {/* Status */}
                          {isVisible('status') && (
                            <td className="px-3 py-2.5 overflow-hidden">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium truncate ${STATUS_STYLES[task.status]}`}>
                                {STATUS_OPTIONS.find((o) => o.value === task.status)?.label}
                              </span>
                            </td>
                          )}

                          {/* Priority */}
                          {isVisible('priority') && (
                            <td className="px-3 py-2.5 overflow-hidden">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium truncate ${PRIORITY_STYLES[task.priority]}`}>
                                {PRIORITY_OPTIONS.find((o) => o.value === task.priority)?.label}
                              </span>
                            </td>
                          )}

                          {/* Direction */}
                          {isVisible('direction') && (
                            <td className="px-3 py-2.5 overflow-hidden">
                              {task.direction ? (
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium truncate max-w-full"
                                  style={
                                    task.direction.color
                                      ? { backgroundColor: task.direction.color + '22', color: task.direction.color }
                                      : { backgroundColor: '#ede9fe', color: '#6d28d9' }
                                  }
                                >
                                  {task.direction.name}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>
                          )}

                          {/* Due date */}
                          {isVisible('due_date') && (
                            <td className="px-3 py-2.5 overflow-hidden">
                              {task.due_date ? (
                                <span className="text-xs text-slate-500 whitespace-nowrap">
                                  {new Date(task.due_date).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>
                          )}

                          {/* Delete */}
                          <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setDeletingId(task.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                              title="Видалити"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>

            </>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Нова задача" size="lg">
        <TaskForm onSuccess={() => setIsCreateOpen(false)} onCancel={() => setIsCreateOpen(false)} />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editingTask} onClose={() => setEditingTask(null)} title="Редагувати задачу" size="lg">
        {editingTask && (
          <TaskForm task={editingTask} onSuccess={() => setEditingTask(null)} onCancel={() => setEditingTask(null)} />
        )}
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={deletingId !== null} onClose={() => setDeletingId(null)} title="Видалити задачу" size="sm">
        <p className="text-slate-600 mb-4 text-sm">Ви впевнені, що хочете видалити цю задачу? Цю дію не можна скасувати.</p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setDeletingId(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
            Скасувати
          </button>
          <button
            onClick={() => deletingId !== null && deleteMutation.mutate(deletingId)}
            disabled={deleteMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60"
          >
            {deleteMutation.isPending ? 'Видалення...' : 'Видалити'}
          </button>
        </div>
      </Modal>

      {/* Settings Modal */}
      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Налаштування" size="xl">
        <div className="flex gap-6 min-h-[400px]">
          {/* Vertical tabs */}
          <nav className="flex flex-col gap-1 w-36 flex-shrink-0 border-r border-slate-100 pr-4">
            {([
              { id: 'fields' as const, label: 'Поля' },
              { id: 'filters' as const, label: 'Фільтри' },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSettingsTab(tab.id)}
                className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  settingsTab === tab.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Tab content */}
          <div className="flex-1 min-w-0">
            {/* ── Поля tab ── */}
            {settingsTab === 'fields' && (
              <div>
                <p className="text-sm text-slate-500 mb-4">Оберіть, які стовпці відображати, та вкажіть їхню ширину (px).</p>
                <div className="space-y-1">
                  <div className="grid grid-cols-[auto_1fr_80px_80px] gap-3 px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <div className="w-4" />
                    <div>Стовпець</div>
                    <div>Мін</div>
                    <div>Макс</div>
                  </div>
                  {COLUMNS.map((col) => {
                    const enabled = draftVisible.includes(col.key)
                    return (
                      <div key={col.key} className="grid grid-cols-[auto_1fr_80px_80px] gap-3 items-center px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                        <input type="checkbox" checked={enabled} onChange={() => toggleDraftColumn(col.key)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                        <span className={`text-sm ${enabled ? 'text-slate-700' : 'text-slate-400'}`}>{col.label}</span>
                        <input type="number" min={0} placeholder="—" value={draftWidths[col.key]?.minWidth ?? ''} onChange={(e) => setDraftWidth(col.key, 'minWidth', e.target.value)} disabled={!enabled} className="w-full px-2 py-1 border border-slate-200 rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-300" />
                        <input type="number" min={0} placeholder="—" value={draftWidths[col.key]?.maxWidth ?? ''} onChange={(e) => setDraftWidth(col.key, 'maxWidth', e.target.value)} disabled={!enabled} className="w-full px-2 py-1 border border-slate-200 rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-300" />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Фільтри tab ── */}
            {settingsTab === 'filters' && (
              <div>
                <p className="text-sm text-slate-500 mb-4">Додайте фільтри та вкажіть вираз для їх комбінування (напр. <code className="bg-slate-100 px-1 rounded">(1 та 2) або 3</code>).</p>

                {/* Filter list */}
                <div className="space-y-2 mb-4">
                  {draftFilters.length === 0 && (
                    <p className="text-xs text-slate-400 italic py-4 text-center">Фільтри не додано</p>
                  )}
                  {draftFilters.map((filter, idx) => {
                    const fieldDef = FILTER_FIELDS.find((f) => f.key === filter.field)
                    const ops = fieldDef ? OPS_BY_TYPE[fieldDef.type] : []
                    const needsValue = !NO_VALUE_OPS.includes(filter.op)
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        {/* Number */}
                        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex-shrink-0">
                          {idx + 1}
                        </span>

                        {/* Field */}
                        <select
                          value={filter.field}
                          onChange={(e) => updateDraftFilter(idx, { field: e.target.value })}
                          className="px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {FILTER_FIELDS.map((f) => (
                            <option key={f.key} value={f.key}>{f.label}</option>
                          ))}
                        </select>

                        {/* Operator */}
                        <select
                          value={filter.op}
                          onChange={(e) => updateDraftFilter(idx, { op: e.target.value as FilterOp })}
                          className="px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {ops.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>

                        {/* Value */}
                        {needsValue && (
                          fieldDef?.options ? (
                            <select
                              value={filter.value}
                              onChange={(e) => updateDraftFilter(idx, { value: e.target.value })}
                              className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="">— оберіть —</option>
                              {fieldDef.options.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          ) : fieldDef?.type === 'date' ? (
                            <div className="flex flex-1 gap-1.5">
                              <select
                                value={DATE_PRESETS.some((p) => p.value === filter.value) ? filter.value : '$custom'}
                                onChange={(e) => updateDraftFilter(idx, { value: e.target.value === '$custom' ? '' : e.target.value })}
                                className="px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              >
                                {DATE_PRESETS.map((p) => (
                                  <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                                <option value="$custom">Вказати дату...</option>
                              </select>
                              {!DATE_PRESETS.some((p) => p.value === filter.value) && (
                                <input
                                  type="date"
                                  value={filter.value}
                                  onChange={(e) => updateDraftFilter(idx, { value: e.target.value })}
                                  className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              )}
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={filter.value}
                              onChange={(e) => updateDraftFilter(idx, { value: e.target.value })}
                              placeholder="Значення"
                              className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          )
                        )}

                        {/* Remove */}
                        <button
                          onClick={() => removeDraftFilter(idx)}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* Add filter button */}
                <button
                  onClick={addDraftFilter}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Додати фільтр
                </button>

                {/* Expression */}
                {draftFilters.length > 1 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Вираз фільтрації</label>
                    <input
                      type="text"
                      value={draftExpression}
                      onChange={(e) => setDraftExpression(e.target.value)}
                      placeholder={`напр. (1 та 2) або ${draftFilters.length}`}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      Використовуйте номери фільтрів, <b>та</b>/<b>and</b>, <b>або</b>/<b>or</b> і дужки. Без виразу всі фільтри об'єднуються через «та».
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-100">
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Скасувати
          </button>
          <button
            onClick={applySettings}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Застосувати
          </button>
        </div>
      </Modal>
    </div>
  )
}
