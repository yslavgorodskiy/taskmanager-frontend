import * as XLSX from 'xlsx'
import type { Task, TaskStatus, TaskPriority } from '../types'

type ColumnKey = 'title' | 'description' | 'status' | 'priority' | 'direction' | 'due_date'

const COLUMN_LABELS: Record<ColumnKey, string> = {
  title: 'Назва',
  description: 'Опис',
  status: 'Статус',
  priority: 'Пріоритет',
  direction: 'Напрямок',
  due_date: 'Дедлайн',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'Нове',
  in_progress: 'В роботі',
  completed: 'Завершено',
  cancelled: 'Скасовано',
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Низький',
  medium: 'Середній',
  high: 'Високий',
  urgent: 'Терміново',
}

function formatDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('uk-UA')
}

function getCellValue(task: Task, key: ColumnKey): string {
  switch (key) {
    case 'title':
      return task.title
    case 'description':
      return task.description ?? ''
    case 'status':
      return STATUS_LABELS[task.status]
    case 'priority':
      return PRIORITY_LABELS[task.priority]
    case 'direction':
      return task.direction?.name ?? ''
    case 'due_date':
      return formatDate(task.due_date)
  }
}

function buildRows(tasks: Task[], visibleColumns: ColumnKey[]): string[][] {
  const header = visibleColumns.map((key) => COLUMN_LABELS[key])
  const rows = tasks.map((task) =>
    visibleColumns.map((key) => getCellValue(task, key)),
  )
  return [header, ...rows]
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function timestamp(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function exportToCSV(tasks: Task[], visibleColumns: ColumnKey[]) {
  const rows = buildRows(tasks, visibleColumns)
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';' })
  const bom = '\uFEFF'
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, `tasks_${timestamp()}.csv`)
}

export function exportToExcel(tasks: Task[], visibleColumns: ColumnKey[]) {
  const rows = buildRows(tasks, visibleColumns)
  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Auto-size columns
  const colWidths = visibleColumns.map((_, i) => {
    const maxLen = rows.reduce((max, row) => Math.max(max, (row[i] ?? '').length), 0)
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) }
  })
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Задачі')
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  triggerDownload(blob, `tasks_${timestamp()}.xlsx`)
}
