import { Fragment, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Plus, RotateCcw } from 'lucide-react'

import { api } from '@/api/client'
import type { Partner } from '@/types/models'
import { useToast } from '@/stores/toast'
import { Modal } from '@/components/Modal'
import { SearchBox } from '@/components/SearchBox'
import { Field, inputCls, selectCls } from '@/components/Field'
import { cn } from '@/lib/utils'

type BizClass = 'customer' | 'vendor' | 'both'

interface PartnerForm {
  id?: number
  code: string; name: string; biz_class: BizClass
  biz_no: string; rep_name: string; address: string
  tel: string; email: string
  vat_type: 'vat' | 'none'; output_name: string; memo: string
  is_active: boolean
}

const BIZ_LABEL: Record<BizClass, string> = { customer: '매출처', vendor: '매입처', both: '매출+매입' }
const BIZ_CLS: Record<BizClass, string> = {
  customer: 'bg-blue-100 text-blue-800',
  vendor:   'bg-purple-100 text-purple-800',
  both:     'bg-emerald-100 text-emerald-800',
}

const blankForm: PartnerForm = {
  code: '', name: '', biz_class: 'customer',
  biz_no: '', rep_name: '', address: '', tel: '', email: '',
  vat_type: 'none', output_name: '', memo: '', is_active: true,
}


type ActiveFilter = 'active' | 'inactive' | 'all'

export function PartnersTab() {
  const qc = useQueryClient()
  const push = useToast((s) => s.push)

  const [search, setSearch] = useState('')
  const [bizClass, setBizClass] = useState('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active')
  const [edit, setEdit] = useState<PartnerForm | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  // 활성/비활성/전체: 서버는 active=1 또는 active=0(전체)만 지원.
  // 'inactive'와 'all'은 active=0으로 받아온 뒤 클라이언트에서 한 번 더 필터.
  const { data: rawRows = [] } = useQuery({
    queryKey: ['partners', search, bizClass, activeFilter === 'active'],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (bizClass) params.set('biz_class', bizClass)
      params.set('active', activeFilter === 'active' ? '1' : '0')
      return api<Partner[]>(`/api/partners?${params}`)
    },
  })

  const rows = useMemo(() => {
    if (activeFilter === 'inactive') return rawRows.filter((r) => !r.is_active)
    return rawRows
  }, [rawRows, activeFilter])

  const save = useMutation({
    mutationFn: (f: PartnerForm) =>
      f.id
        ? api<Partner>(`/api/partners/${f.id}`, { method: 'PATCH', body: f })
        : api<Partner>('/api/partners', { method: 'POST', body: f }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partners'] })
      setEdit(null)
      push('저장됨', 'success')
    },
    onError: (e) => push(`저장 실패: ${e.message}`, 'error', 5000),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/partners/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partners'] })
      push('비활성화됨', 'info')
    },
  })

  const restore = useMutation({
    mutationFn: (id: number) =>
      api<Partner>(`/api/partners/${id}`, { method: 'PATCH', body: { is_active: true } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partners'] })
      push('복원됨', 'success')
    },
    onError: (e) => push(`복원 실패: ${e.message}`, 'error', 5000),
  })

  function toggle(id: number) {
    setExpanded((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-5 flex items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex-1">거래처관리</h2>
        <button onClick={() => setEdit({ ...blankForm })}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-4 py-2 inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> 거래처 추가
        </button>
      </header>

      <div className="bg-white rounded-xl border border-slate-200 p-3 mb-3 flex items-center gap-3 flex-wrap">
        <SearchBox value={search} onChange={setSearch}
                   placeholder="코드, 이름, 사업자번호, 대표자 검색" className="flex-1 min-w-[200px]" />
        <select value={bizClass} onChange={(e) => setBizClass(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
          <option value="">전체 구분</option>
          <option value="customer">매출처</option>
          <option value="vendor">매입처</option>
          <option value="both">매출+매입</option>
        </select>
        <div className="inline-flex rounded-lg overflow-hidden border border-slate-300">
          {(['active', 'inactive', 'all'] as const).map((f) => (
            <button key={f} onClick={() => setActiveFilter(f)}
                    className={cn('px-3 py-2 text-xs font-semibold transition',
                      activeFilter === f
                        ? f === 'inactive' ? 'bg-slate-600 text-white' : 'bg-blue-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50')}>
              {f === 'active' ? '활성' : f === 'inactive' ? '비활성' : '전체'}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 tabular-nums">{rows.length}건</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wide">
            <tr>
              <th className="px-3 py-2.5 w-8"></th>
              <th className="px-3 py-2.5 text-left font-medium w-24">코드</th>
              <th className="px-3 py-2.5 text-left font-medium">거래처명</th>
              <th className="px-3 py-2.5 text-left font-medium w-24">구분</th>
              <th className="px-3 py-2.5 text-left font-medium w-32">사업자번호</th>
              <th className="px-3 py-2.5 text-left font-medium w-24">대표자</th>
              <th className="px-3 py-2.5 text-left font-medium w-32">전화</th>
              <th className="px-3 py-2.5 text-center font-medium w-20">계좌</th>
              <th className="px-3 py-2.5 text-right font-medium w-20"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr className={cn(
                  'border-t border-slate-100',
                  r.is_active ? 'hover:bg-slate-50' : 'bg-slate-50/60 text-slate-400 hover:bg-slate-100/60',
                )}>
                  <td className="px-3 py-2">
                    {r.accounts.length > 0 && (
                      <button onClick={() => toggle(r.id)} className="text-slate-400 hover:text-slate-700">
                        <ChevronRight className={cn('w-4 h-4 transition-transform', expanded.has(r.id) && 'rotate-90')} />
                      </button>
                    )}
                  </td>
                  <td className={cn('px-3 py-2 font-mono text-xs tabular-nums', r.is_active ? 'text-slate-600' : 'text-slate-400')}>{r.code}</td>
                  <td className={cn('px-3 py-2 font-medium', r.is_active ? 'text-slate-900' : 'text-slate-500 line-through')}>
                    {r.name}
                    {!r.is_active && (
                      <span className="ml-2 inline-block text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-semibold no-underline">비활성</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold',
                      r.is_active ? BIZ_CLS[r.biz_class] : 'bg-slate-200 text-slate-500')}>
                      {BIZ_LABEL[r.biz_class]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums">{r.biz_no}</td>
                  <td className="px-3 py-2">{r.rep_name}</td>
                  <td className="px-3 py-2 text-xs tabular-nums">{r.tel}</td>
                  <td className="px-3 py-2 text-center text-xs">{r.accounts.length || '—'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => setEdit({ ...r })} className="text-blue-600 hover:text-blue-800 text-xs mr-2">수정</button>
                    {r.is_active ? (
                      <button onClick={() => confirm(`'${r.name}'을 비활성화 할까요?`) && remove.mutate(r.id)}
                              className="text-rose-500 hover:text-rose-700 text-xs">삭제</button>
                    ) : (
                      <button onClick={() => restore.mutate(r.id)}
                              className="text-emerald-600 hover:text-emerald-800 text-xs inline-flex items-center gap-0.5">
                        <RotateCcw className="w-3 h-3" /> 복원
                      </button>
                    )}
                  </td>
                </tr>
                {expanded.has(r.id) && r.accounts.length > 0 && (
                  <tr className="bg-slate-50/70">
                    <td colSpan={9} className="px-12 py-3">
                      <div className="text-xs text-slate-500 mb-1.5">계좌 ({r.accounts.length}건)</div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-slate-400">
                            <th className="text-left font-medium pb-1 w-24">은행</th>
                            <th className="text-left font-medium pb-1 w-48">계좌번호</th>
                            <th className="text-left font-medium pb-1 w-32">예금주</th>
                            <th className="text-left font-medium pb-1">별칭</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.accounts.map((a) => (
                            <tr key={a.id} className="text-slate-700">
                              <td className="py-1">{a.bank}</td>
                              <td className="py-1 tabular-nums">{a.account_no}</td>
                              <td className="py-1">{a.holder}</td>
                              <td className="py-1 text-slate-500">{a.nickname}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!rows.length && (
              <tr><td colSpan={9} className="text-center text-slate-400 py-10 text-sm">
                {activeFilter === 'inactive' ? '비활성 거래처가 없습니다.' : '거래처가 없습니다.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? '거래처 수정' : '거래처 추가'} size="xl">
        {edit && (
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(edit) }} className="grid grid-cols-2 gap-3">
            <Field label="거래처코드">
              {edit.id ? (
                <input value={edit.code} readOnly tabIndex={-1}
                       className={inputCls + ' tabular-nums bg-slate-50 text-slate-500 cursor-not-allowed'}/>
              ) : (
                <input value="저장 시 자동 부여" readOnly tabIndex={-1}
                       className={inputCls + ' bg-slate-50 text-slate-400 italic cursor-not-allowed'}/>
              )}
            </Field>
            <Field label="거래처명 *"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required className={inputCls}/></Field>
            <Field label="구분">
              <select value={edit.biz_class} onChange={(e) => setEdit({ ...edit, biz_class: e.target.value as BizClass })} className={selectCls}>
                <option value="customer">매출처</option>
                <option value="vendor">매입처</option>
                <option value="both">매출+매입</option>
              </select>
            </Field>
            <Field label="VAT 기본값">
              <select value={edit.vat_type} onChange={(e) => setEdit({ ...edit, vat_type: e.target.value as 'vat' | 'none' })} className={selectCls}>
                <option value="none">VAT 없음</option>
                <option value="vat">VAT 포함</option>
              </select>
            </Field>
            <Field label="사업자번호"><input value={edit.biz_no} onChange={(e) => setEdit({ ...edit, biz_no: e.target.value })} className={inputCls + ' tabular-nums'}/></Field>
            <Field label="대표자"><input value={edit.rep_name} onChange={(e) => setEdit({ ...edit, rep_name: e.target.value })} className={inputCls}/></Field>
            <Field label="사업장주소" full><input value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} className={inputCls}/></Field>
            <Field label="전화"><input value={edit.tel} onChange={(e) => setEdit({ ...edit, tel: e.target.value })} className={inputCls + ' tabular-nums'}/></Field>
            <Field label="이메일"><input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} className={inputCls}/></Field>
            <Field label="출력용 거래처명" full><input value={edit.output_name} onChange={(e) => setEdit({ ...edit, output_name: e.target.value })} placeholder="명세서에 다른 이름으로 찍을 때" className={inputCls}/></Field>
            <Field label="비고" full><textarea value={edit.memo} onChange={(e) => setEdit({ ...edit, memo: e.target.value })} rows={2} className={inputCls}/></Field>
            <div className="col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEdit(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">취소</button>
              <button type="submit" className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg">저장</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
