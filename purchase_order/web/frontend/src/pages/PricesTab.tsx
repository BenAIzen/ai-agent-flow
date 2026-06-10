import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'

import { api } from '@/api/client'
import type { Partner, PartnerPrice } from '@/types/models'
import { useToast } from '@/stores/toast'
import { Modal } from '@/components/Modal'
import { ItemPicker } from '@/components/ItemPicker'
import { SearchBox } from '@/components/SearchBox'
import { cn, formatNum, todayISO } from '@/lib/utils'

interface PriceForm {
  id?: number
  partner: number | null
  item: number | null
  sale_price: number
  purchase_price: number
  effective_from: string
  memo: string
  is_active: boolean
}

export function PricesTab() {
  const qc = useQueryClient()
  const push = useToast((s) => s.push)

  const [partnerSearch, setPartnerSearch] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [partnerId, setPartnerId] = useState<number | null>(null)
  const [edit, setEdit] = useState<PriceForm | null>(null)

  const { data: partners = [] } = useQuery({
    queryKey: ['partners-list', partnerSearch],
    queryFn: () => api<Partner[]>(`/api/partners${partnerSearch ? `?q=${encodeURIComponent(partnerSearch)}` : ''}`),
  })

  // 처음 partners 로드 시 첫 거래처 자동 선택
  useEffect(() => {
    if (!partnerId && partners.length) setPartnerId(partners[0].id)
  }, [partners, partnerId])

  const { data: prices = [] } = useQuery({
    queryKey: ['prices', partnerId, itemSearch],
    queryFn: () => {
      if (!partnerId) return Promise.resolve([] as PartnerPrice[])
      const params = new URLSearchParams({ partner: String(partnerId) })
      if (itemSearch) params.set('q', itemSearch)
      return api<PartnerPrice[]>(`/api/prices?${params}`)
    },
    enabled: !!partnerId,
  })

  const save = useMutation({
    mutationFn: (f: PriceForm) =>
      f.id ? api(`/api/prices/${f.id}`, { method: 'PATCH', body: f })
           : api('/api/prices', { method: 'POST', body: f }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prices'] })
      setEdit(null); push('저장됨', 'success')
    },
    onError: (e) => push(`저장 실패: ${e.message}`, 'error', 5000),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/prices/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prices'] }),
  })

  const currentPartner = partners.find((p) => p.id === partnerId)

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-5">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">거래처별 단가등록</h2>
        <p className="text-sm text-slate-500 mt-1">
          거래처를 좌측에서 선택하고 우측에서 품목별 매출/매입 단가를 등록합니다.
          출고처리 시 발주일자 기준으로 가장 최근 적용일의 단가가 자동 적용됩니다.
        </p>
      </header>

      <div className="grid grid-cols-12 gap-4">
        {/* LEFT */}
        <div className="col-span-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-slate-50">
            <SearchBox value={partnerSearch} onChange={setPartnerSearch} placeholder="거래처 검색" />
          </div>
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
            {partners.map((p) => (
              <button
                key={p.id}
                onClick={() => setPartnerId(p.id)}
                className={cn(
                  'w-full text-left px-3 py-2.5 border-b border-slate-50 hover:bg-blue-50',
                  partnerId === p.id && 'bg-blue-100 border-l-4 border-l-blue-500'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-500 tabular-nums">{p.code}</span>
                  <span className="text-sm font-medium text-slate-800 truncate">{p.name}</span>
                </div>
              </button>
            ))}
            {!partners.length && (
              <div className="text-center text-slate-400 py-8 text-sm">거래처가 없습니다</div>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="col-span-8 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
            <div className="flex-1">
              <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">선택된 거래처</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {currentPartner ? `${currentPartner.code} ${currentPartner.name}` : '거래처를 선택하세요'}
              </div>
            </div>
            <SearchBox value={itemSearch} onChange={setItemSearch} placeholder="품목 검색" className="w-48" />
            <button
              onClick={() => setEdit({
                partner: partnerId, item: null,
                sale_price: 0, purchase_price: 0,
                effective_from: todayISO(), memo: '', is_active: true,
              })}
              disabled={!partnerId}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold rounded-lg px-3 py-1.5 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> 단가 추가
            </button>
          </div>

          <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wide sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium w-32">품목코드</th>
                  <th className="px-3 py-2 text-left font-medium">품명</th>
                  <th className="px-3 py-2 text-left font-medium w-20">규격</th>
                  <th className="px-3 py-2 text-left font-medium w-12">단위</th>
                  <th className="px-3 py-2 text-right font-medium w-24">매입단가</th>
                  <th className="px-3 py-2 text-right font-medium w-24">매출단가</th>
                  <th className="px-3 py-2 text-left font-medium w-28">적용시작일</th>
                  <th className="px-3 py-2 text-right font-medium w-20"></th>
                </tr>
              </thead>
              <tbody>
                {prices.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-1.5 font-mono text-xs text-slate-600 tabular-nums">{r.item_code}</td>
                    <td className="px-3 py-1.5 text-slate-900">{r.item_name}</td>
                    <td className="px-3 py-1.5 text-slate-500 text-xs">{r.item_spec}</td>
                    <td className="px-3 py-1.5 text-slate-500 text-xs">{r.item_unit}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatNum(r.purchase_price)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{formatNum(r.sale_price)}</td>
                    <td className="px-3 py-1.5 text-slate-500 text-xs tabular-nums">{r.effective_from}</td>
                    <td className="px-3 py-1.5 text-right">
                      <button onClick={() => setEdit({
                        id: r.id, partner: r.partner, item: r.item,
                        sale_price: Number(r.sale_price), purchase_price: Number(r.purchase_price),
                        effective_from: r.effective_from, memo: r.memo, is_active: r.is_active,
                      })} className="text-blue-600 hover:text-blue-800 text-xs mr-2">수정</button>
                      <button onClick={() => confirm('이 단가를 삭제할까요?') && remove.mutate(r.id)}
                              className="text-rose-500 hover:text-rose-700 text-xs">삭제</button>
                    </td>
                  </tr>
                ))}
                {!prices.length && partnerId && (
                  <tr><td colSpan={8} className="text-center text-slate-400 py-10 text-sm">등록된 단가가 없습니다.</td></tr>
                )}
                {!partnerId && (
                  <tr><td colSpan={8} className="text-center text-slate-400 py-10 text-sm">좌측에서 거래처를 선택하세요.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? '단가 수정' : '단가 추가'}>
        {edit && (
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(edit) }} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">품목 *</label>
              <div className="border border-slate-300 rounded-lg">
                <ItemPicker value={edit.item} onChange={(it) => setEdit({ ...edit, item: it.id })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">매출단가 *</label>
                <input type="number" step="0.01" value={edit.sale_price}
                       onChange={(e) => setEdit({ ...edit, sale_price: Number(e.target.value) })} required
                       className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-right tabular-nums"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">매입단가</label>
                <input type="number" step="0.01" value={edit.purchase_price}
                       onChange={(e) => setEdit({ ...edit, purchase_price: Number(e.target.value) })}
                       className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-right tabular-nums"/>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">적용 시작일 *</label>
              <input type="date" value={edit.effective_from}
                     onChange={(e) => setEdit({ ...edit, effective_from: e.target.value })} required
                     className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm tabular-nums"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">비고</label>
              <input value={edit.memo} onChange={(e) => setEdit({ ...edit, memo: e.target.value })}
                     className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"/>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEdit(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">취소</button>
              <button type="submit" disabled={!edit.item}
                      className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg">저장</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
