import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Printer, Settings } from 'lucide-react'

import { api } from '@/api/client'
import type { InvoiceData, InvoiceSetting } from '@/types/models'
import { useToast } from '@/stores/toast'
import { Modal } from '@/components/Modal'
import { PartnerPicker } from '@/components/PartnerPicker'
import { formatNum, todayISO } from '@/lib/utils'

export function InvoiceTab() {
  const qc = useQueryClient()
  const push = useToast((s) => s.push)

  const [partnerId, setPartnerId] = useState<number | null>(null)
  const [date, setDate] = useState(todayISO())
  const [showSettings, setShowSettings] = useState(false)
  const [enabled, setEnabled] = useState(false)

  const { data: setting } = useQuery({
    queryKey: ['invoice-setting'],
    queryFn: () => api<InvoiceSetting>('/api/invoice/setting'),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['invoice-preview', partnerId, date],
    queryFn: () => api<InvoiceData>(`/api/invoice/preview?partner=${partnerId}&date=${date}`),
    enabled: enabled && !!partnerId,
  })

  const saveSetting = useMutation({
    mutationFn: (s: Partial<InvoiceSetting>) =>
      api<InvoiceSetting>('/api/invoice/setting', { method: 'PUT', body: s }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-setting'] })
      qc.invalidateQueries({ queryKey: ['invoice-preview'] })
      setShowSettings(false)
      push('설정 저장됨', 'success')
    },
  })

  function loadPreview() {
    if (!partnerId) { push('거래처를 선택하세요', 'warn'); return }
    setEnabled(true)
    qc.invalidateQueries({ queryKey: ['invoice-preview'] })
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-5 flex items-center gap-4 no-print">
        <FileText className="w-6 h-6 text-emerald-600"/>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex-1">거래명세서</h2>
        <button onClick={() => setShowSettings(true)}
                className="text-sm text-slate-600 hover:text-slate-900 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg px-3 py-2 inline-flex items-center gap-1.5">
          <Settings className="w-4 h-4" /> 양식 설정
        </button>
        <button onClick={() => window.print()} disabled={!data}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg px-4 py-2 inline-flex items-center gap-1.5">
          <Printer className="w-4 h-4" /> 인쇄 / PDF로 저장
        </button>
      </header>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 no-print">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs font-semibold text-slate-500">거래처</label>
          <div className="min-w-[240px]">
            <PartnerPicker value={partnerId} onChange={(p) => setPartnerId(p.id)} />
          </div>
          <label className="text-xs font-semibold text-slate-500 ml-3">발행일</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                 className="px-2 py-2 border border-slate-300 rounded-lg text-sm tabular-nums"/>
          <button onClick={loadPreview} disabled={!partnerId}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg px-4 py-2 ml-auto">
            조회
          </button>
        </div>
      </div>

      {data && setting && (
        <div className="invoice-sheet bg-white border border-slate-300 p-8 shadow-sm"
             style={{ fontFamily: '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif' }}>
          <h1 className="text-center text-3xl font-bold mb-1" style={{ letterSpacing: '0.5em' }}>거 래 명 세 서</h1>
          <div className="text-center text-xs text-slate-500 mb-4">(공급받는자용 / 공급자보관용)</div>

          <div className="mb-3 text-sm">
            <span className="font-semibold">납품년월일:</span>{' '}
            <span className="tabular-nums">{data.date.replace(/-/g, '. ')}</span>
          </div>

          <table className="w-full border-collapse mb-4">
            <thead>
              <tr>
                <th className="w-1/2 border border-slate-400 bg-slate-100 p-2 text-sm">공급받는자 (買受人)</th>
                <th className="w-1/2 border border-slate-400 bg-slate-100 p-2 text-sm">공급자 (供給者)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-400 align-top p-2 text-xs space-y-0.5">
                  <div><strong>상호:</strong> {data.partner.name}</div>
                  <div><strong>등록번호:</strong> <span className="tabular-nums">{data.partner.biz_no}</span></div>
                  <div><strong>대표자:</strong> {data.partner.rep_name}</div>
                  <div><strong>주소:</strong> {data.partner.address}</div>
                  <div><strong>TEL:</strong> <span className="tabular-nums">{data.partner.tel}</span></div>
                </td>
                <td className="border border-slate-400 align-top p-2 text-xs space-y-0.5">
                  <div><strong>상호:</strong> {data.company.name}</div>
                  <div><strong>등록번호:</strong> <span className="tabular-nums">{data.company.biz_no || ''}</span></div>
                  <div><strong>대표자:</strong> {data.company.rep_name || ''}</div>
                </td>
              </tr>
            </tbody>
          </table>

          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 p-1 w-10">No.</th>
                <th className="border border-slate-400 p-1">품 명</th>
                {setting.show_spec && <th className="border border-slate-400 p-1 w-20">규격</th>}
                <th className="border border-slate-400 p-1 w-12">단위</th>
                {setting.show_qty && <th className="border border-slate-400 p-1 w-16">수량</th>}
                {setting.show_unit_price && <th className="border border-slate-400 p-1 w-20">단가</th>}
                {setting.show_amount && <th className="border border-slate-400 p-1 w-24">공급가액</th>}
                {setting.show_vat && <th className="border border-slate-400 p-1 w-20">부가세</th>}
                <th className="border border-slate-400 p-1 w-24">합계금액</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((l, i) => (
                <tr key={i}>
                  <td className="border border-slate-400 p-1 text-center">{i + 1}</td>
                  <td className="border border-slate-400 p-1">{l.item_name}</td>
                  {setting.show_spec && <td className="border border-slate-400 p-1">{l.spec}</td>}
                  <td className="border border-slate-400 p-1 text-center">{l.unit}</td>
                  {setting.show_qty && <td className="border border-slate-400 p-1 text-right tabular-nums">{formatNum(l.qty)}</td>}
                  {setting.show_unit_price && <td className="border border-slate-400 p-1 text-right tabular-nums">{formatNum(l.unit_price)}</td>}
                  {setting.show_amount && <td className="border border-slate-400 p-1 text-right tabular-nums">{formatNum(l.supply_amount)}</td>}
                  {setting.show_vat && <td className="border border-slate-400 p-1 text-right tabular-nums">{formatNum(l.vat_amount)}</td>}
                  <td className="border border-slate-400 p-1 text-right tabular-nums">{formatNum(l.total)}</td>
                </tr>
              ))}
              {!data.lines.length && (
                <tr><td colSpan={9} className="border border-slate-400 p-4 text-center text-slate-400">이 날짜에 출고 내역이 없습니다.</td></tr>
              )}
            </tbody>
            {setting.show_total_amount && (
              <tfoot>
                <tr className="bg-slate-100 font-bold">
                  <td colSpan={6} className="border border-slate-400 p-1 text-right">합 계</td>
                  {setting.show_amount && <td className="border border-slate-400 p-1 text-right tabular-nums">{formatNum(data.subtotal)}</td>}
                  {setting.show_vat && <td className="border border-slate-400 p-1 text-right tabular-nums">{formatNum(data.vat_total)}</td>}
                  <td className="border border-slate-400 p-1 text-right tabular-nums">{formatNum(data.today_total)}</td>
                </tr>
              </tfoot>
            )}
          </table>

          {(setting.show_receivable || setting.show_today_total) && (
            <table className="w-full border-collapse text-xs mt-4">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-400 p-1 w-1/4">전미수액</th>
                  {setting.show_today_total && <th className="border border-slate-400 p-1 w-1/4">당일거래총액</th>}
                  <th className="border border-slate-400 p-1 w-1/4">입금액</th>
                  <th className="border border-slate-400 p-1 w-1/4">미수액</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-400 p-1 text-right tabular-nums">{formatNum(data.outstanding_before)}</td>
                  {setting.show_today_total && <td className="border border-slate-400 p-1 text-right tabular-nums font-semibold">{formatNum(data.today_total)}</td>}
                  <td className="border border-slate-400 p-1 text-right tabular-nums">{formatNum(data.paid_today)}</td>
                  <td className="border border-slate-400 p-1 text-right tabular-nums font-bold text-rose-700">{formatNum(data.outstanding_after)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {!data && !isLoading && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm no-print">
          상단에서 거래처와 날짜를 선택하고 "조회" 버튼을 누르세요.
        </div>
      )}

      <Modal open={showSettings} onClose={() => setShowSettings(false)} title="거래명세서 양식 저장 (16개 옵션)" size="xl">
        {setting && <SettingsForm setting={setting} onSave={(s) => saveSetting.mutate(s)} onCancel={() => setShowSettings(false)} />}
      </Modal>
    </div>
  )
}

function SettingsForm({ setting, onSave, onCancel }: {
  setting: InvoiceSetting
  onSave: (s: Partial<InvoiceSetting>) => void
  onCancel: () => void
}) {
  const [local, setLocal] = useState(setting)
  function toggle<K extends keyof InvoiceSetting>(key: K) {
    setLocal({ ...local, [key]: !local[key] } as InvoiceSetting)
  }
  function setField<K extends keyof InvoiceSetting>(key: K, v: InvoiceSetting[K]) {
    setLocal({ ...local, [key]: v })
  }

  const CheckRow = ({ label, k }: { label: string; k: keyof InvoiceSetting }) => (
    <label className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg text-sm">
      <input type="checkbox" checked={local[k] as boolean} onChange={() => toggle(k)}/>
      {label}
    </label>
  )

  return (
    <>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <CheckRow label="1. 공급자란 인쇄" k="show_supplier_seal" />
        <CheckRow label="2. 배송지주소" k="show_delivery_addr" />
        <CheckRow label="3. 수량계 인쇄" k="show_qty_total" />
        <CheckRow label="4. 부가가치세 표시" k="show_vat" />
        <CheckRow label="5. 소수점 표시" k="show_decimal" />
        <CheckRow label="6. 수량 표시" k="show_qty" />
        <CheckRow label="7. 단가 표시" k="show_unit_price" />
        <CheckRow label="8. 금액 표시" k="show_amount" />
        <CheckRow label="9. 합계금액 표시" k="show_total_amount" />
        <CheckRow label="10. 채권 표시" k="show_receivable" />
        <div className="col-span-2 p-2 border border-slate-200 rounded-lg">
          <label className="text-xs font-semibold text-slate-600 mb-1 block">11. 담당자 인쇄</label>
          <select value={local.representative_type} onChange={(e) => setField('representative_type', e.target.value)}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm bg-white">
            <option value="supplier">1. 공급자</option>
            <option value="partner_b">2. 거래처-기초</option>
            <option value="partner_a">3. 거래처-추가</option>
            <option value="delivery">4. 배송지</option>
          </select>
        </div>
        <CheckRow label="12. 품목비고 표시" k="show_item_memo" />
        <div className="col-span-2 p-2 border border-slate-200 rounded-lg">
          <label className="text-xs font-semibold text-slate-600 mb-1 block">13. 거래명세서비고 표시</label>
          <select value={local.invoice_memo_field} onChange={(e) => setField('invoice_memo_field', e.target.value)}
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm bg-white">
            <option value="memo1">1. 비고1</option>
            <option value="memo2">2. 비고2</option>
            <option value="memo3">3. 비고3</option>
            <option value="all">4. 전체</option>
          </select>
        </div>
        <CheckRow label="14. 규격 표시" k="show_spec" />
        <CheckRow label="15. 순백지1,2 세액 표시" k="show_tax_amount" />
        <CheckRow label="16. 당일거래총액 표시" k="show_today_total" />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">취소</button>
        <button onClick={() => onSave(local)} className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg">저장</button>
      </div>
    </>
  )
}
