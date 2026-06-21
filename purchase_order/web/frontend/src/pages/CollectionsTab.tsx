import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'

import { api } from '@/api/client'
import type { Collection } from '@/types/models'
import { useToast } from '@/stores/toast'
import { Modal } from '@/components/Modal'
import { SearchBox } from '@/components/SearchBox'
import { PartnerPicker } from '@/components/PartnerPicker'
import { DateRangeBar } from '@/components/DateRangeBar'
import { firstOfMonthISO, formatNum, todayISO } from '@/lib/utils'

const RECEIPT_TYPES = [
  ['cash', '1. 현금'], ['deposit', '2. 예금'], ['card', '3. 카드'], ['note', '4. 어음'],
  ['discount_prod', '5. 할인(상품)'], ['discount_made', '6. 할인(제품)'],
  ['prepay_cash', '7. 선수금(현금)'], ['prepay_dep', '8. 선수금(예금)'],
  ['prepay_clear', '9. 선수금정리'], ['offset', '10. 상계'],
  ['misc_loss', '11. 잡손실'], ['misc_gain', '12. 잡이익'],
] as const

interface CollectionForm {
  id?: number
  receipt_date: string
  partner: number | null
  receipt_type: string
  amount: number
  bank_account: number | null
  note: string
}

const blankForm = (): CollectionForm => ({
  receipt_date: todayISO(),
  partner: null,
  receipt_type: 'cash',
  amount: 0,
  bank_account: null,
  note: '',
})

export function CollectionsTab() {
  const qc = useQueryClient()
  const push = useToast((s) => s.push)
  const [dateFrom, setDateFrom] = useState(firstOfMonthISO())
  const [dateTo, setDateTo] = useState(todayISO())
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<CollectionForm | null>(null)

  const { data: rows = [] } = useQuery({
    queryKey: ['collections', dateFrom, dateTo, search],
    queryFn: () => {
      const p = new URLSearchParams({ from: dateFrom, to: dateTo })
      if (search) p.set('q', search)
      return api<Collection[]>(`/api/collections?${p}`)
    },
  })

  const save = useMutation({
    mutationFn: (f: CollectionForm) =>
      f.id ? api(`/api/collections/${f.id}`, { method: 'PATCH', body: f })
           : api('/api/collections', { method: 'POST', body: f }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collections'] })
      setEdit(null); push('저장됨', 'success')
    },
    onError: (e) => push(`저장 실패: ${e.message}`, 'error', 5000),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/collections/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collections'] }),
  })

  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0)

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-5 flex items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex-1">수금등록</h2>
        <button onClick={() => setEdit(blankForm())}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-4 py-2 inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> 수금 추가
        </button>
      </header>

      <DateRangeBar from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo}>
        <SearchBox value={search} onChange={setSearch}
                   placeholder="수금번호, 거래처, 적요 검색" className="flex-1 min-w-[200px]" />
        <span className="text-xs text-slate-400 tabular-nums">{rows.length}건</span>
      </DateRangeBar>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wide">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium w-28">수금일자</th>
              <th className="px-3 py-2.5 text-left font-medium w-44">수금번호</th>
              <th className="px-3 py-2.5 text-left font-medium">거래처</th>
              <th className="px-3 py-2.5 text-left font-medium w-28">수금유형</th>
              <th className="px-3 py-2.5 text-right font-medium w-32">금액</th>
              <th className="px-3 py-2.5 text-left font-medium">적요</th>
              <th className="px-3 py-2.5 text-right font-medium w-20"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 tabular-nums text-slate-600">{r.receipt_date}</td>
                <td className="px-3 py-2 font-mono text-xs tabular-nums text-slate-700">{r.receipt_no}</td>
                <td className="px-3 py-2 text-slate-900 font-medium">{r.partner_name}</td>
                <td className="px-3 py-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                    {r.receipt_type_label}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatNum(r.amount)}</td>
                <td className="px-3 py-2 text-slate-500 text-xs truncate max-w-[200px]">{r.note}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => setEdit({
                    id: r.id, receipt_date: r.receipt_date, partner: r.partner,
                    receipt_type: r.receipt_type, amount: Number(r.amount),
                    bank_account: r.bank_account, note: r.note,
                  })} className="text-blue-600 hover:text-blue-800 text-xs mr-2">수정</button>
                  <button onClick={() => confirm(`${r.receipt_no} 수금을 삭제할까요?`) && remove.mutate(r.id)}
                          className="text-rose-500 hover:text-rose-700 text-xs">삭제</button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={7} className="text-center text-slate-400 py-10 text-sm">이 기간의 수금이 없습니다.</td></tr>
            )}
          </tbody>
          <tfoot className="bg-slate-50 font-bold">
            <tr>
              <td colSpan={4} className="px-3 py-2 text-right text-xs text-slate-600">합 계</td>
              <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{formatNum(total)}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? '수금 수정' : '수금 추가'}>
        {edit && (
          <form onSubmit={(e) => { e.preventDefault(); if (!edit.partner) { push('거래처를 선택하세요', 'warn'); return } save.mutate(edit) }} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">수금일자 *</label>
              <input type="date" value={edit.receipt_date} onChange={(e) => setEdit({ ...edit, receipt_date: e.target.value })} required
                     className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm tabular-nums"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">거래처 *</label>
              <PartnerPicker value={edit.partner} onChange={(p) => setEdit({ ...edit, partner: p.id })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">수금유형 *</label>
                <select value={edit.receipt_type} onChange={(e) => setEdit({ ...edit, receipt_type: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                  {RECEIPT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">금액 *</label>
                <input type="number" step="0.01" value={edit.amount}
                       onChange={(e) => setEdit({ ...edit, amount: Number(e.target.value) })} required
                       className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-right tabular-nums"/>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">적요</label>
              <input value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })}
                     className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"/>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEdit(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">취소</button>
              <button type="submit" className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg">저장</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
