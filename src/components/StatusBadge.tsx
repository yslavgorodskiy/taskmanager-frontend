import type { TaskStatus } from '../types'

interface Props {
  status: TaskStatus
}

const config: Record<TaskStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-800' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-600' },
}

export default function StatusBadge({ status }: Props) {
  const { label, className } = config[status] ?? config.new
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
