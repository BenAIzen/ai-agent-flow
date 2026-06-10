import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'

import { api } from '@/api/client'
import type { Item } from '@/types/models'
import { useToast } from '@/stores/toast'
import { Modal } from '@/components/Modal'
import { SearchBox } from '@/components/SearchBox'

interface ItemForm {
  id?: number
  code: string; name: string; spec: string
  procure_type: string; account_type: string
  unit_in: string; unit_out: string; unit_stock: string
  standard_cost: number
  invoice_print_name: string; memo: string
  is_active: boolean
}

const blankForm: ItemForm = {
  code: '', name: '', spec: '',
  procure_type: 'buy', account_type: 'product',
  unit_in: 'kg', unit_out: 'kg', unit_stock: 'kg',
  standard_cost: 0, invoice_print_name: '', memo: '', is_active: true,
}

const inputCls  = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
const selectCls = inputCls + ' bg-white'

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : undefined}>
      <label className="text-xs font-semibold text-slate-600 mb-1 block">{label}</label>
      {children}
    </div>
  )
}

export function ItemsTab() {
  const qc = useQueryClient()
  const push = useToast((s) => s.push)
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<ItemForm | null>(null)

  const { data: rows = [] } = useQuery({
    queryKey: ['items', search],
    queryFn: () => api<Item[]>(`/api/items${search ? `?q=${encodeURIComponent(search)}` : ''}`),
  })

  const save = useMutation({
    mutationFn: (f: ItemForm) =>
      f.id ? api<Item>(`/api/items/${f.id}`, { method: 'PATCH', body: f })
           : api<Item>('/api/items', { method: 'POST', body: f }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] })
      setEdit(null); push('저장됨', 'success')
    },
    onError: (e) => push(`저장 실패: ${e.message}`, 'error', 5000),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/items/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
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

      <div className="bg-white rounded-xl border border-slate-200 p-3 mb-3 flex items-center gap-3">
        <SearchBox value={search} onChange={setSearch} placeholder="품목코드, 품명, 규격 검색" className="flex-1" />
        <span className="text-xs text-slate-400 tabular-nums">{rows.length}건</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wide">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium w-32">품목코드</th>
              <th className="px-3 py-2.5 text-left font-medium">품명</th>
              <th className="px-3 py-2.5 text-left font-medium w-24">규격</th>
              <th className="px-3 py-2.5 text-left font-medium w-16">단위</th>
              <th className="px-3 py-2.5 text-right font-medium w-24">표준원가</th>
              <th className="px-3 py-2.5 text-right font-medium w-20"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs text-slate-600 tabular-nums">{r.code}</td>
                <td className="px-3 py-2 font-medium text-slate-900">{r.name}</td>
                <td className="px-3 py-2 text-slate-600 text-xs">{r.spec}</td>
                <td className="px-3 py-2 text-slate-500 text-xs">{r.unit_out}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">{Number(r.standard_cost).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => setEdit({ ...r, standard_cost: Number(r.standard_cost) })}
                          className="text-blue-600 hover:text-blue-800 text-xs mr-2">수정</button>
                  <button onClick={() => confirm(`'${r.name}'을 비활성화 할까요?`) && remove.mutate(r.id)}
                          className="text-rose-500 hover:text-rose-700 text-xs">삭제</button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={6} className="text-center text-slate-400 py-10 text-sm">품목이 없습니다. 우측 상단 "품목 추가"로 시작하세요.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? '품목 수정' : '품목 추가'} size="xl">
        {edit && (
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(edit) }} className="grid grid-cols-2 gap-3">
            <Field label="품목코드 *"><input value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} required className={inputCls + ' tabular-nums'}/></Field>
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
            <Field label="표준원가">
              <input type="number" step="0.01" value={edit.standard_cost}
                     onChange={(e) => setEdit({ ...edit, standard_cost: Number(e.target.value) })}
                     className={inputCls + ' text-right tabular-nums'}/>
            </Field>
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
