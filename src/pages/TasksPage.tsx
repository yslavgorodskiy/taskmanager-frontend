import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { tasksApi } from '../api/tasks'
import { directionsApi } from '../api/directions'
import { tagsApi } from '../api/tags'
import { usersApi } from '../api/users'
import type { Task, TaskCreate, TaskStatus, TaskPriority, TaskUpdate, ColumnSettings } from '../types'
import Modal from '../components/Modal'

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

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [draftVisible, setDraftVisible] = useState<ColumnKey[]>([])
  const [draftWidths, setDraftWidths] = useState<ColumnWidths>({})

  const openSettings = () => {
    setDraftVisible([...columnSettings.visible] as ColumnKey[])
    setDraftWidths(structuredClone(columnSettings.widths))
    setIsSettingsOpen(true)
  }

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

  const applySettings = () => {
    const visible = draftVisible.length > 0 ? draftVisible : [...ALL_COLUMN_KEYS]
    const next: ColumnSettings = { visible, widths: draftWidths }
    saveMutation.mutate(next)
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
  const [selectedDirectionIds, setSelectedDirectionIds] = useState<number[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>([])

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.getTasks({}),
  })

  const { data: directions = [] } = useQuery({
    queryKey: ['directions'],
    queryFn: directionsApi.getDirections,
  })

  const deleteMutation = useMutation({
    mutationFn: tasksApi.deleteTask,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); setDeletingId(null) },
  })

  const toggleDirection = (id: number) => {
    setSelectedDirectionIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    )
  }

  const toggleStatus = (status: TaskStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    )
  }

  const filteredTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      if (selectedDirectionIds.length > 0 && !selectedDirectionIds.includes(task.direction?.id ?? -1)) return false
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(task.status)) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        if (!task.title.toLowerCase().includes(q) && !(task.description ?? '').toLowerCase().includes(q)) return false
      }
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
  }, [tasks, selectedDirectionIds, selectedStatuses, searchQuery, sortKey, sortOrder])

  const activeFiltersCount = (selectedDirectionIds.length > 0 ? 1 : 0) + (selectedStatuses.length > 0 ? 1 : 0)

  const clearAllFilters = () => {
    setSelectedDirectionIds([])
    setSelectedStatuses([])
    setSearchQuery('')
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
                      checked={selectedDirectionIds.includes(dir.id)}
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
                    checked={selectedStatuses.includes(opt.value)}
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
            {/* View toggle */}
            <div className="flex items-center border border-slate-200 rounded-md overflow-hidden text-xs">
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 font-medium border-r border-slate-200">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18M3 14h18M3 18h18" />
                </svg>
                Таблиця
              </button>
            </div>

            {/* Active filters badge */}
            {activeFiltersCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-md text-xs font-medium hover:bg-violet-200 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                </svg>
                {activeFiltersCount} {activeFiltersCount === 1 ? 'фільтр' : 'фільтри'}
              </button>
            )}

            {/* Record count */}
            <span className="text-xs text-slate-400 whitespace-nowrap">
              {filteredTasks.length} {filteredTasks.length === 1 ? 'запис' : 'записів'}
              {filteredTasks.length !== tasks.length && `, фільтр...`}
            </span>

            {/* Settings */}
            <button onClick={openSettings} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors">
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

      {/* Column Settings Modal */}
      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Налаштування стовпців" size="md">
        <p className="text-sm text-slate-500 mb-4">Оберіть, які стовпці відображати, та вкажіть їхню ширину (px).</p>
        <div className="space-y-1">
          {/* Header */}
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
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => toggleDraftColumn(col.key)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className={`text-sm ${enabled ? 'text-slate-700' : 'text-slate-400'}`}>{col.label}</span>
                <input
                  type="number"
                  min={0}
                  placeholder="—"
                  value={draftWidths[col.key]?.minWidth ?? ''}
                  onChange={(e) => setDraftWidth(col.key, 'minWidth', e.target.value)}
                  disabled={!enabled}
                  className="w-full px-2 py-1 border border-slate-200 rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-300"
                />
                <input
                  type="number"
                  min={0}
                  placeholder="—"
                  value={draftWidths[col.key]?.maxWidth ?? ''}
                  onChange={(e) => setDraftWidth(col.key, 'maxWidth', e.target.value)}
                  disabled={!enabled}
                  className="w-full px-2 py-1 border border-slate-200 rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-300"
                />
              </div>
            )
          })}
        </div>
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
