import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'

import { api } from '@/api/client'
import type { Item } from '@/types/models'
import { Modal } from './Modal'
import { cn } from '@/lib/utils'

interface Props {
  value: number | null
  onChange: (it: Item) => void
  placeholder?: string
}

export function ItemPicker({ value, onChange, placeholder = '품목 선택...' }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (value) {
      api<Item>(`/api/items/${value}`).then((it) => setLabel(`${it.code} ${it.name}`)).catch(() => {})
    } else {
      setLabel('')
    }
  }, [value])

  const { data: results = [] } = useQuery({
    queryKey: ['items-picker', search],
    queryFn: () => api<Item[]>(`/api/items${search ? `?q=${encodeURIComponent(search)}` : ''}`),
    enabled: open,
    staleTime: 30_000,
  })

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full px-2 py-1 text-sm hover:bg-slate-50 rounded text-left"
      >
        <span className={label ? 'text-slate-900' : 'text-slate-400'}>{label || placeholder}</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="품목 선택">
        <div className="relative mb-3">
          <input
            type="text" autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="품목코드, 품명"
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        </div>
        <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
          {results.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => { onChange(it); setOpen(false) }}
              className={cn(
                'w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-100 text-sm',
                it.id === value && 'bg-blue-50'
              )}
            >
              <span className="font-mono text-xs text-slate-500 tabular-nums mr-2">{it.code}</span>
              <span>{it.name}</span>
              {it.spec && <span className="text-xs text-slate-400 ml-2">{it.spec}</span>}
            </button>
          ))}
          {!results.length && (
            <div className="text-center text-slate-400 py-6 text-sm">검색 결과 없음</div>
          )}
        </div>
      </Modal>
    </>
  )
}
