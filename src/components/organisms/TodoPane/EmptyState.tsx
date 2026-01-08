import { CheckCircle2 } from 'lucide-react'

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-white/5 flex items-center justify-center mb-4">
        <CheckCircle2 size={24} className="text-gray-400 dark:text-gray-500" />
      </div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">No tasks yet</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Type <code className="px-1.5 py-0.5 bg-gray-200 dark:bg-white/5 rounded text-gray-600 dark:text-gray-400 font-mono">/todo</code> in any note
      </p>
    </div>
  )
}
