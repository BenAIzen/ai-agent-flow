import { Fragment, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Plus, Trash2 } from 'lucide-react'

import { api } from '@/api/client'
import type { DeliveryOrder, Item } from '@/types/models'
import { useToast } from '@/stores/toast'
import { Modal } from '@/components/Modal'
import { SearchBox } from '@/components/SearchBox'
import { PartnerPicker } from '@/components/PartnerPicker'
import { ItemPicker } from '@/components/ItemPicker'
import { cn, firstOfMonthISO, formatNum, todayISO } from '@/lib/utils'

interface LineForm {
  item: number | null
  item_code: string
  item_name: string
  spec: string
  unit: string
  qty: number
  unit_price: number
  note: string
}

interface OrderForm {
  id?: number
  order_date: string
  partner: number | null
  vat_type: 'vat' | 'none'
  tax_type: 'taxable' | 'exempt' | 'zero'
  note: string
  lines: LineForm[]
}

const blankOrder = (): OrderForm => ({
  order_date: todayISO(),
  partner: null,
  vat_type: 'none',
  tax_type: 'exempt',
  note: '',
  lines: [],
})

const blankLine = (): LineForm => ({
  item: null, item_code: '', item_name: '',
  spec: '', unit: '', qty: 0, unit_price: 0, note: '',
})

export function DeliveryTab() {
  const qc = useQueryClient()
  const push = useToast((s) => s.push)

  const [dateFrom, setDateFrom] = useState(firstOfMonthISO())
  const [dateTo, setDateTo] = useState(todayISO())
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<OrderForm | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)

  const { data: orders = [] } = useQuery({
    queryKey: ['deliveries', dateFrom, dateTo, search],
    queryFn: () => {
      const p = new URLSearchParams({ from: dateFrom, to: dateTo })
      if (search) p.set('q', search)
      return api<DeliveryOrder[]>(`/api/delivery?${p}`)
    },
  })

  const save = useMutation({
    mutationFn: (f: OrderForm) => {
      const payload = {
        order_date: f.order_date, partner: f.partner,
        vat_type: f.vat_type, tax_type: f.tax_type, note: f.note,
        lines: f.lines.map((l) => ({
          item: l.item, spec: l.spec, unit: l.unit,
          qty: l.qty, unit_price: l.unit_price, note: l.note,
        })),
      }
      return f.id
        ? api(`/api/delivery/${f.id}`, { method: 'PATCH', body: payload })
        : api('/api/delivery', { method: 'POST', body: payload })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deliveries'] })
      setEdit(null); push('저장됨', 'success')
    },
    onError: (e) => push(`저장 실패: ${e.message}`, 'error', 5000),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/delivery/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deliveries'] }),
  })

  async function fillPrice(idx: number, line: LineForm) {
    if (!edit?.partner || !line.item) return
    try {
      const r = await api<{ unit_price: number | string }>(
        `/api/delivery/suggest-price?partner=${edit.partner}&item=${line.item}&date=${edit.order_date}`
      )
      updateLine(idx, { unit_price: Number(r.unit_price) })
    } catch { /* ignore */ }
  }

  function updateLine(i: number, patch: Partial<LineForm>) {
    if (!edit) return
    const lines = [...edit.lines]
    lines[i] = { ...lines[i], ...patch }
    setEdit({ ...edit, lines })
  }

  function addLine() {
    if (!edit) return
    setEdit({ ...edit, lines: [...edit.lines, blankLine()] })
  }

  function removeLine(i: number) {
    if (!edit) return
    setEdit({ ...edit, lines: edit.lines.filter((_, idx) => idx !== i) })
  }

  function lineSupply(l: LineForm) { return Number(l.qty || 0) * Number(l.unit_price || 0) }
  function lineVat(l: LineForm) { return edit?.vat_type === 'vat' ? lineSupply(l) * 0.1 : 0 }
  const editSubtotal = edit?.lines.reduce((s, l) => s + lineSupply(l), 0) ?? 0
  const editVat = edit?.lines.reduce((s, l) => s + lineVat(l), 0) ?? 0
  const editTotal = editSubtotal + editVat

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-5 flex items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex-1">출고처리</h2>
        <button onClick={() => setEdit(blankOrder())}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-4 py-2 inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> 출고전표 추가
        </button>
      </header>

      <div className="bg-white rounded-xl border border-slate-200 p-3 mb-3 flex items-center gap-3 flex-wrap">
        <label className="text-xs font-semibold text-slate-500">기간</label>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
               className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm tabular-nums"/>
        <span className="text-slate-400">~</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
               className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm tabular-nums"/>
        <SearchBox value={search} onChange={setSearch}
                   placeholder="출고번호, 거래처, 적요 검색" className="flex-1 min-w-[200px]"/>
        <span className="text-xs text-slate-400 tabular-nums">{orders.length}건</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wide">
            <tr>
              <th className="px-3 py-2.5 w-8"></th>
              <th className="px-3 py-2.5 text-left font-medium w-28">출고일자</th>
              <th className="px-3 py-2.5 text-left font-medium w-44">출고번호</th>
              <th className="px-3 py-2.5 text-left font-medium">거래처</th>
              <th className="px-3 py-2.5 text-center font-medium w-16">VAT</th>
              <th className="px-3 py-2.5 text-right font-medium w-28">공급가액</th>
              <th className="px-3 py-2.5 text-right font-medium w-24">부가세</th>
              <th className="px-3 py-2.5 text-right font-medium w-28">합계</th>
              <th className="px-3 py-2.5 text-right font-medium w-20"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <Fragment key={o.id}>
                <tr className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <button onClick={() => setExpanded(expanded === o.id ? null : o.id)} className="text-slate-400 hover:text-slate-700">
                      <ChevronRight className={cn('w-4 h-4 transition-transform', expanded === o.id && 'rotate-90')} />
                    </button>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-600">{o.order_date}</td>
                  <td className="px-3 py-2 font-mono text-xs tabular-nums text-slate-700">{o.order_no}</td>
                  <td className="px-3 py-2 text-slate-900 font-medium">{o.partner_name}</td>
                  <td className={cn('px-3 py-2 text-center text-xs', o.vat_type === 'vat' ? 'text-blue-700 font-semibold' : 'text-slate-400')}>
                    {o.vat_type === 'vat' ? '포함' : '없음'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNum(o.subtotal)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{formatNum(o.vat_total)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatNum(o.total)}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setEdit({
                      id: o.id, order_date: o.order_date, partner: o.partner,
                      vat_type: o.vat_type, tax_type: o.tax_type, note: o.note,
                      lines: o.lines.map((l) => ({
                        item: l.item, item_code: l.item_code, item_name: l.item_name,
                        spec: l.spec, unit: l.unit,
                        qty: Number(l.qty), unit_price: Number(l.unit_price), note: l.note,
                      })),
                    })} className="text-blue-600 hover:text-blue-800 text-xs mr-2">수정</button>
                    <button onClick={() => confirm(`${o.order_no} 전표를 삭제할까요?`) && remove.mutate(o.id)}
                            className="text-rose-500 hover:text-rose-700 text-xs">삭제</button>
                  </td>
                </tr>
                {expanded === o.id && (
                  <tr className="bg-slate-50/70">
                    <td colSpan={9} className="px-12 py-3">
                      <div className="text-xs text-slate-500 mb-1.5">출고 라인 ({o.lines.length}건)</div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-slate-400">
                            <th className="text-left font-medium pb-1 w-28">품목코드</th>
                            <th className="text-left font-medium pb-1">품명</th>
                            <th className="text-left font-medium pb-1 w-20">규격</th>
                            <th className="text-left font-medium pb-1 w-12">단위</th>
                            <th className="text-right font-medium pb-1 w-20">수량</th>
                            <th className="text-right font-medium pb-1 w-24">단가</th>
                            <th className="text-right font-medium pb-1 w-28">공급가액</th>
                          </tr>
                        </thead>
                        <tbody>
                          {o.lines.map((l) => (
                            <tr key={l.id} className="text-slate-700">
                              <td className="py-1 font-mono tabular-nums text-slate-500">{l.item_code}</td>
                              <td className="py-1">{l.item_name}</td>
                              <td className="py-1 text-slate-500">{l.spec}</td>
                              <td className="py-1 text-slate-500">{l.unit}</td>
                              <td className="py-1 text-right tabular-nums">{formatNum(l.qty)}</td>
                              <td className="py-1 text-right tabular-nums">{formatNum(l.unit_price)}</td>
                              <td className="py-1 text-right tabular-nums font-semibold">{formatNum(l.supply_amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!orders.length && (
              <tr><td colSpan={9} className="text-center text-slate-400 py-10 text-sm">이 기간의 출고전표가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? '출고전표 수정' : '출고전표 추가'} size="5xl">
        {edit && (
          <>
            <div className="grid grid-cols-4 gap-3 mb-5">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">출고일자 *</label>
                <input type="date" value={edit.order_date} onChange={(e) => setEdit({ ...edit, order_date: e.target.value })}
                       className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm tabular-nums"/>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">거래처 *</label>
                <PartnerPicker value={edit.partner} onChange={(p) => setEdit({ ...edit, partner: p.id })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">VAT 여부</label>
                <select value={edit.vat_type} onChange={(e) => setEdit({ ...edit, vat_type: e.target.value as 'vat' | 'none' })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                  <option value="none">VAT 없음</option>
                  <option value="vat">VAT 포함</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">과세구분</label>
                <select value={edit.tax_type} onChange={(e) => setEdit({ ...edit, tax_type: e.target.value as 'taxable' | 'exempt' | 'zero' })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                  <option value="exempt">면세</option>
                  <option value="taxable">과세</option>
                  <option value="zero">영세</option>
                </select>
              </div>
              <div className="col-span-3">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">적요</label>
                <input value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })}
                       className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"/>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 flex items-center gap-2 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">품목 라인</span>
                <button onClick={addLine} className="ml-auto text-xs bg-blue-600 hover:bg-blue-700 text-white rounded px-2.5 py-1">
                  + 라인 추가
                </button>
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 bg-slate-50 border-b">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">품목</th>
                    <th className="px-2 py-1.5 text-left font-medium w-20">규격</th>
                    <th className="px-2 py-1.5 text-left font-medium w-12">단위</th>
                    <th className="px-2 py-1.5 text-right font-medium w-20">수량</th>
                    <th className="px-2 py-1.5 text-right font-medium w-24">단가</th>
                    <th className="px-2 py-1.5 text-right font-medium w-28">공급가액</th>
                    <th className="px-2 py-1.5 text-right font-medium w-24">부가세</th>
                    <th className="px-2 py-1.5 text-right font-medium w-28">합계</th>
                    <th className="px-2 py-1.5 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {edit.lines.map((line, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-2 py-1">
                        <ItemPicker
                          value={line.item}
                          partnerId={edit.partner}
                          onChange={(it: Item) => {
                            updateLine(i, {
                              item: it.id, item_code: it.code, item_name: it.name,
                              spec: it.spec, unit: it.unit_out,
                            })
                            setTimeout(() => fillPrice(i, { ...line, item: it.id }), 0)
                          }}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input value={line.spec} onChange={(e) => updateLine(i, { spec: e.target.value })}
                               className="w-full px-2 py-1 text-xs border border-slate-300 rounded"/>
                      </td>
                      <td className="px-2 py-1">
                        <input value={line.unit} onChange={(e) => updateLine(i, { unit: e.target.value })}
                               className="w-full px-2 py-1 text-xs border border-slate-300 rounded"/>
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" step="0.001" value={line.qty}
                               onChange={(e) => updateLine(i, { qty: Number(e.target.value) })}
                               className="w-full px-2 py-1 text-sm border border-slate-300 rounded text-right tabular-nums"/>
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" step="0.01" value={line.unit_price}
                               onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) })}
                               className="w-full px-2 py-1 text-sm border border-slate-300 rounded text-right tabular-nums"/>
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums text-slate-700">{formatNum(lineSupply(line))}</td>
                      <td className="px-2 py-1 text-right tabular-nums text-slate-500">{formatNum(lineVat(line))}</td>
                      <td className="px-2 py-1 text-right tabular-nums font-semibold">{formatNum(lineSupply(line) + lineVat(line))}</td>
                      <td className="px-2 py-1 text-center">
                        <button onClick={() => removeLine(i)} className="text-rose-500 hover:text-rose-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!edit.lines.length && (
                    <tr><td colSpan={9} className="text-center text-slate-400 py-6 text-sm">"라인 추가" 버튼을 눌러 품목을 등록하세요.</td></tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold">
                  <tr>
                    <td colSpan={5} className="px-2 py-2 text-right text-xs text-slate-600">합 계</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatNum(editSubtotal)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-500">{formatNum(editVat)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-blue-700">{formatNum(editTotal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button onClick={() => setEdit(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">취소</button>
              <button
                onClick={() => {
                  if (!edit.partner) { push('거래처를 선택하세요', 'warn'); return }
                  if (!edit.lines.length || edit.lines.some((l) => !l.item)) {
                    push('품목 라인을 모두 채우세요', 'warn'); return
                  }
                  save.mutate(edit)
                }}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
              >
                저장
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
