import { useToast } from '@/stores/toast'
import { cn } from '@/lib/utils'

const KIND_CLS = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  warn:    'bg-amber-50 border-amber-200 text-amber-900',
  error:   'bg-rose-50 border-rose-200 text-rose-900',
  info:    'bg-white border-slate-200 text-slate-800',
}

export function ToastContainer() {
  const items = useToast((s) => s.items)
  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto rounded-lg shadow-lg px-4 py-3 text-sm max-w-sm border',
            KIND_CLS[t.kind]
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
