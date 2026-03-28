import type { TaskStatus } from '../types'

interface Props { status: TaskStatus }

const config: Record<TaskStatus, { label: string; className: string }> = {
  new:         { label: 'Нове',      className: 'bg-[#fff9c4] text-[#795548] border border-[#f9a825]' },
  in_progress: { label: 'В роботі', className: 'bg-[#fff3cd] text-[#856404] border border-[#ffc107]' },
  completed:   { label: 'Завершено', className: 'bg-[#d4edda] text-[#155724] border border-[#28a745]' },
  cancelled:   { label: 'Скасовано',className: 'bg-[#f8f9fa] text-[#6c757d] border border-[#ced4da]' },
}

export default function StatusBadge({ status }: Props) {
  const { label, className } = config[status] ?? config.new
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-[10px] text-[11px] font-semibold whitespace-nowrap ${className}`}>
      {label}
    </span>
  )
}
