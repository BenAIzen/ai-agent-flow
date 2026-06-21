import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  debounceMs?: number
  className?: string
}

/** 250ms 디바운스 + 검색 아이콘. */
export function SearchBox({ value, onChange, placeholder = '검색', debounceMs = 250, className }: Props) {
  const [local, setLocal] = useState(value)

  useEffect(() => { setLocal(value) }, [value])

  useEffect(() => {
    const t = setTimeout(() => {
      if (local !== value) onChange(local)
    }, debounceMs)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local])

  return (
    <div className={cn('relative', className)}>
      <input
        type="text" value={local} onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm outline-none bg-white"
      />
      <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
    </div>
  )
}
