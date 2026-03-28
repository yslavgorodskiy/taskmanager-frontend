import type { TaskPriority } from '../types'

interface Props { priority: TaskPriority }

const config: Record<TaskPriority, { label: string; className: string }> = {
  low:    { label: 'Низький',   className: 'bg-[#f8f9fa] text-[#6c757d] border border-[#ced4da]' },
  medium: { label: 'Середній', className: 'bg-[#e3f2fd] text-[#0d47a1] border border-[#90caf9]' },
  high:   { label: 'Високий',  className: 'bg-[#fff3e0] text-[#e65100] border border-[#ffb74d]' },
  urgent: { label: 'Терміново',className: 'bg-[#ffebee] text-[#b71c1c] border border-[#ef9a9a]' },
}

export default function PriorityBadge({ priority }: Props) {
  const { label, className } = config[priority] ?? config.medium
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-[10px] text-[11px] font-semibold whitespace-nowrap ${className}`}>
      {label}
    </span>
  )
}
