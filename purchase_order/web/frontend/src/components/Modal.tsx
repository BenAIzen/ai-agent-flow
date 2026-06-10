import { type ReactNode, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '5xl'
}

const SIZES = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-lg',
  xl:   'max-w-2xl',
  '2xl':'max-w-3xl',
  '5xl':'max-w-5xl',
}

export function Modal({ open, onClose, title, children, size = 'md' }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-40 px-4"
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-white rounded-2xl shadow-2xl w-full p-6 max-h-[95vh] overflow-y-auto',
          SIZES[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h3 className="text-lg font-bold mb-4">{title}</h3>}
        {children}
      </div>
    </div>
  )
}
