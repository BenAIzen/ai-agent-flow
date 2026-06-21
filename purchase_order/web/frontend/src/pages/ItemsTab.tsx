import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'

import { api } from '@/api/client'
import type { Item } from '@/types/models'
import { useToast } from '@/stores/toast'
import { Modal } from '@/components/Modal'
import { SearchBox } from '@/components/SearchBox'
import { PartnerPicker } from '@/components/PartnerPicker'
import { Field, inputCls, selectCls } from '@/components/Field'

interface ItemForm {
  id?: number
  code: string
  partner: number | null
  partner_name?: string | null
  partner_code?: string | null
  name: string; spec: string
  procure_type: string; account_type: string
  unit_in: string; unit_out: string; unit_stock: string
  invoice_print_name: string; memo: string
  is_active: boolean
}

const blankForm: ItemForm = {
  code: '', partner: null, name: '', spec: '',
  procure_type: 'buy', account_type: 'product',
  unit_in: 'kg', unit_out: 'kg', unit_stock: 'kg',
  invoice_print_name: '', memo: '', is_active: true,
}


export function ItemsTab() {
  const qc = useQueryClient()
  const push = useToast((s) => s.push)
  const [search, setSearch] = useState('')
  const [partnerFilter, setPartnerFilter] = useState<number | null>(null)
  const [partnerFilterLabel, setPartnerFilterLabel] = useState('')
  const [edit, setEdit] = useState<ItemForm | null>(null)

  const { data: rows = [] } = useQuery({
    queryKey: ['items', search, partnerFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (partnerFilter) params.set('partner', String(partnerFilter))
      return api<Item[]>(`/api/items?${params}`)
    },
  })

  const save = useMutation({
    mutationFn: (f: ItemForm) => {
      // PATCH/POST 응답 모두 Item으로 받음. partner_name/code는 응답값 사용.
      const payload: Record<string, unknown> = { ...f }
      delete payload.partner_name
      delete payload.partner_code
      return f.id
        ? api<Item>(`/api/items/${f.id}`, { method: 'PATCH', body: payload })
        : api<Item>('/api/items', { method: 'POST', body: payload })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] })
      setEdit(null); push('저장됨', 'success')
    },
    onError: (e) => push(`저장 실패: ${e.message}`, 'error', 5000),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/items/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['items'] }); push('삭제됨', 'success') },
    onError: (e) => push(e.message || '삭제 실패', 'error', 6000),
  })

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-5 flex items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex-1">품목관리</h2>
        <button onClick={() => setEdit({ ...blankForm })}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-4 py-2 inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> 품목 추가
        </button>
      </header>

      <div className="bg-white rounded-xl border border-slate-200 p-3 mb-3 flex items-center gap-3 flex-wrap">
        <SearchBox value={search} onChange={setSearch} placeholder="품목코드, 품명, 규격, 거래처명 검색" className="flex-1 min-w-[200px]" />
        <div className="flex items-center gap-1">
          <PartnerPicker
            value={partnerFilter}
            onChange={(p) => { setPartnerFilter(p.id); setPartnerFilterLabel(`${p.code} ${p.name}`) }}
            placeholder={partnerFilterLabel || '거래처로 필터'}
          />
          {partnerFilter && (
            <button onClick={() => { setPartnerFilter(null); setPartnerFilterLabel('') }}
                    className="text-xs text-slate-500 hover:text-slate-700 px-2">해제</button>
          )}
        </div>
        <span className="text-xs text-slate-400 tabular-nums">{rows.length}건</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wide">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium w-24">코드</th>
              <th className="px-3 py-2.5 text-left font-medium w-40">거래처</th>
              <th className="px-3 py-2.5 text-left font-medium">품명</th>
              <th className="px-3 py-2.5 text-left font-medium w-24">규격</th>
              <th className="px-3 py-2.5 text-left font-medium w-16">단위</th>
              <th className="px-3 py-2.5 text-right font-medium w-20"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs text-slate-600 tabular-nums">{r.code}</td>
                <td className="px-3 py-2 text-xs text-slate-700">
                  {r.partner_name ? (
                    <>
                      <span className="font-mono text-slate-400 tabular-nums mr-1">{r.partner_code}</span>
                      {r.partner_name}
                    </>
                  ) : (
                    <span className="text-slate-300 italic">미지정</span>
                  )}
                </td>
                <td className="px-3 py-2 font-medium text-slate-900">{r.name}</td>
                <td className="px-3 py-2 text-slate-600 text-xs">{r.spec}</td>
                <td className="px-3 py-2 text-slate-500 text-xs">{r.unit_out}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => setEdit({ ...r })}
                          className="text-blue-600 hover:text-blue-800 text-xs mr-2">수정</button>
                  <button onClick={() => confirm(`'${r.name}'을 영구 삭제할까요? (거래 내역 있으면 삭제 안 됨)`) && remove.mutate(r.id)}
                          className="text-rose-500 hover:text-rose-700 text-xs">삭제</button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={6} className="text-center text-slate-400 py-10 text-sm">
                {partnerFilter ? '이 거래처의 품목이 없습니다.' : '품목이 없습니다. 우측 상단 "품목 추가"로 시작하세요.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? '품목 수정' : '품목 추가'} size="xl">
        {edit && (
          <form onSubmit={(e) => {
            e.preventDefault()
            if (!edit.partner) { push('거래처를 선택해 주세요', 'warn'); return }
            save.mutate(edit)
          }} className="grid grid-cols-2 gap-3">
            <Field label="거래처 *" full>
              <PartnerPicker
                value={edit.partner}
                onChange={(p) => setEdit({ ...edit, partner: p.id, partner_name: p.name, partner_code: p.code })}
                placeholder="거래처 선택 (필수)"
              />
            </Field>
            <Field label="품목코드">
              {edit.id ? (
                <input value={edit.code} readOnly tabIndex={-1}
                       className={inputCls + ' tabular-nums bg-slate-50 text-slate-500 cursor-not-allowed'}/>
              ) : (
                <input value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })}
                       required placeholder="예: 001"
                       className={inputCls + ' tabular-nums'}/>
              )}
            </Field>
            <Field label="규격 (원산지)"><input value={edit.spec} onChange={(e) => setEdit({ ...edit, spec: e.target.value })} placeholder="국내산 / 수입산 / 중국산" className={inputCls}/></Field>
            <Field label="품명 *" full><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required className={inputCls}/></Field>
            <Field label="조달구분">
              <select value={edit.procure_type} onChange={(e) => setEdit({ ...edit, procure_type: e.target.value })} className={selectCls}>
                <option value="buy">구매품</option>
                <option value="make">생산품</option>
                <option value="subcontract">외주</option>
              </select>
            </Field>
            <Field label="품목계정">
              <select value={edit.account_type} onChange={(e) => setEdit({ ...edit, account_type: e.target.value })} className={selectCls}>
                <option value="product">상품</option>
                <option value="material">원재료</option>
                <option value="sub_material">부재료</option>
                <option value="manufactured">제품</option>
                <option value="semi">반제품</option>
                <option value="byproduct">부산품</option>
                <option value="storage">저장품</option>
              </select>
            </Field>
            <Field label="입고단위"><input value={edit.unit_in} onChange={(e) => setEdit({ ...edit, unit_in: e.target.value })} className={inputCls}/></Field>
            <Field label="출고단위"><input value={edit.unit_out} onChange={(e) => setEdit({ ...edit, unit_out: e.target.value })} className={inputCls}/></Field>
            <Field label="재고단위"><input value={edit.unit_stock} onChange={(e) => setEdit({ ...edit, unit_stock: e.target.value })} className={inputCls}/></Field>
            <Field label="거래명세서 출력명" full><input value={edit.invoice_print_name} onChange={(e) => setEdit({ ...edit, invoice_print_name: e.target.value })} className={inputCls}/></Field>
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

