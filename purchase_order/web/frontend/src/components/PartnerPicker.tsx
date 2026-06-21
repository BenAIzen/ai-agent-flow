import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'

import { api } from '@/api/client'
import type { Partner } from '@/types/models'
import { Modal } from './Modal'
import { cn } from '@/lib/utils'

interface Props {
  value: number | null
  onChange: (p: Partner) => void
  placeholder?: string
  bizClass?: 'customer' | 'vendor' | 'both' | ''
}

export function PartnerPicker({ value, onChange, placeholder = '거래처 선택...', bizClass = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [label, setLabel] = useState('')

  // 선택된 거래처의 표시 라벨을 가져옴
  useEffect(() => {
    if (value) {
      api<Partner>(`/api/partners/${value}`).then((p) => setLabel(`${p.code} ${p.name}`)).catch(() => {})
    } else {
      setLabel('')
    }
  }, [value])

  const { data: results = [] } = useQuery({
    queryKey: ['partners-picker', search, bizClass],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (bizClass) params.set('biz_class', bizClass)
      return api<Partner[]>(`/api/partners?${params}`)
    },
    enabled: open,
    staleTime: 30_000,
  })

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-left bg-white hover:bg-slate-50"
      >
        <span className={label ? 'text-slate-900' : 'text-slate-400'}>{label || placeholder}</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="거래처 선택">
        <div className="relative mb-3">
          <input
            type="text" autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="코드, 이름, 사업자번호"
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        </div>
        <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onChange(p); setOpen(false) }}
              className={cn(
                'w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-100 text-sm',
                p.id === value && 'bg-blue-50'
              )}
            >
              <span className="font-mono text-xs text-slate-500 tabular-nums mr-2">{p.code}</span>
              <span>{p.name}</span>
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
