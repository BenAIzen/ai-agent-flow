import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Star } from 'lucide-react'

import { api } from '@/api/client'
import { useAuth, type Company } from '@/stores/auth'
import { useToast } from '@/stores/toast'
import { Modal } from '@/components/Modal'
import { cn } from '@/lib/utils'

interface CompanyForm {
  name: string
  biz_type: '법인' | '개인'
  biz_no: string
  rep_name: string
  is_default: boolean
}

const blankForm: CompanyForm = {
  name: '', biz_type: '법인', biz_no: '', rep_name: '', is_default: false,
}

export function CompanySelectPage() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const { setCompany, logout } = useAuth()
  const push = useToast((s) => s.push)

  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CompanyForm>(blankForm)

  const { data: companies = [] } = useQuery({
    queryKey: ['companies', search],
    queryFn: () => api<Company[]>(`/api/companies?q=${encodeURIComponent(search)}`),
  })

  const create = useMutation({
    mutationFn: (body: CompanyForm) =>
      api<Company>('/api/companies', { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      setOpen(false); setForm(blankForm)
      push('회사 추가됨', 'success')
    },
    onError: (e) => push(`추가 실패: ${e.message}`, 'error'),
  })

  const setDefault = useMutation({
    mutationFn: async (c: Company) => {
      for (const x of companies.filter((p) => p.is_default && p.id !== c.id)) {
        await api(`/api/companies/${x.id}`, { method: 'PATCH', body: { is_default: false } })
      }
      return api<Company>(`/api/companies/${c.id}`, {
        method: 'PATCH', body: { is_default: !c.is_default },
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  })

  function selectCompany(c: Company) {
    setCompany(c)
    nav({ to: '/main' })
  }

  function doLogout() {
    logout()
    nav({ to: '/login' })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">회사관리</h1>
            <p className="text-sm text-blue-100 mt-0.5">사용할 회사를 선택하거나 추가하세요</p>
          </div>
          <button onClick={doLogout}
                  className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition">
            로그아웃
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1">
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="회사이름, 사업자번호, 대표자명으로 검색하세요"
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300
                         focus:border-blue-500 focus:ring-2 focus:ring-blue-100
                         text-sm outline-none bg-white"
            />
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
          </div>
          <button onClick={() => setOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold
                             rounded-lg px-4 py-2.5 inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> 회사 추가
          </button>
        </div>

        <div className="space-y-2.5">
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => selectCompany(c)}
              className={cn(
                'w-full bg-white border-2 rounded-xl p-4 text-left transition-all',
                'hover:border-blue-400 hover:shadow-md flex items-start gap-4',
                c.is_default ? 'border-blue-500' : 'border-slate-200'
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-slate-900 text-base truncate">{c.name}</span>
                  {c.is_default && (
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100
                                     px-2 py-0.5 rounded-full">대표</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className={cn(
                    'px-2 py-0.5 rounded font-semibold',
                    c.biz_type === '법인' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'
                  )}>
                    {c.biz_type}
                  </span>
                  <span className="tabular-nums">{c.biz_no || '—'}</span>
                  {c.rep_name && <><span className="text-slate-400">|</span>
                    <span className="text-slate-700">{c.rep_name}</span></>}
                </div>
              </div>
              <div
                role="button" tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setDefault.mutate(c) }}
                className="text-slate-300 hover:text-amber-500 transition"
                title={c.is_default ? '대표 회사' : '대표로 설정'}
              >
                <Star className={cn('w-5 h-5', c.is_default && 'fill-amber-400 text-amber-400')} />
              </div>
            </button>
          ))}

          {!companies.length && (
            <div className="text-center text-slate-400 py-12 text-sm">
              등록된 회사가 없습니다. "회사 추가"로 시작하세요.
            </div>
          )}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="회사 추가">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form) }} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">회사명 *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                   required className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">구분</label>
              <select value={form.biz_type} onChange={(e) => setForm({ ...form, biz_type: e.target.value as '법인' | '개인' })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white">
                <option value="법인">법인</option>
                <option value="개인">개인</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">사업자번호</label>
              <input value={form.biz_no} onChange={(e) => setForm({ ...form, biz_no: e.target.value })}
                     placeholder="000-00-00000"
                     className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">대표자명</label>
            <input value={form.rep_name} onChange={(e) => setForm({ ...form, rep_name: e.target.value })}
                   className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 mt-2">
            <input type="checkbox" checked={form.is_default}
                   onChange={(e) => setForm({ ...form, is_default: e.target.checked })}/>
            대표 회사로 설정
          </label>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={() => setOpen(false)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">취소</button>
            <button type="submit" disabled={!form.name}
                    className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:bg-blue-300 text-white font-semibold rounded-lg">
              추가
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
