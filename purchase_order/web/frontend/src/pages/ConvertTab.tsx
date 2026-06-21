import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Download, Loader2, PackagePlus, UploadCloud, X } from 'lucide-react'

import { api } from '@/api/client'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'
import { Badge, Metric } from '@/components/Badge'
import { cn, formatNum } from '@/lib/utils'

interface Line {
  품목코드?: string; 품명?: string; 수량?: string | number; 단위?: string; 단가?: string | number
}
interface SummaryEntry {
  file: string; status: string; date: string; business: string
  line_count: number; lines: Line[]
}
interface NewPartnerCandidate { name: string }
interface NewItemCandidate {
  partner_name: string; is_new_partner: boolean
  name: string; unit: string
}
interface NewPriceCandidate {
  partner_name: string; item_name: string
  sale_price: string; effective_from: string
}
interface NewOrderLine {
  item_name: string; spec: string; unit: string
  qty: string; unit_price: string
}
interface NewOrderCandidate {
  partner_name: string; is_new_partner: boolean
  order_date: string; lines: NewOrderLine[]
}
interface ConvertResult {
  summary: SummaryEntry[]; download_id: string; total_rows: number
  new_partner_candidates: NewPartnerCandidate[]
  new_item_candidates: NewItemCandidate[]
  new_price_candidates: NewPriceCandidate[]
  new_order_candidates: NewOrderCandidate[]
  items_matched: number
  prices_matched: number
}

// 편집 가능 행 (include 토글 포함)
interface PartnerRow { name: string; include: boolean }
interface ItemRow {
  partner_name: string; is_new_partner: boolean
  name: string; unit: string; include: boolean
}
interface PriceRow {
  partner_name: string; item_name: string
  sale_price: string; effective_from: string; include: boolean
}
interface OrderRow {
  partner_name: string; is_new_partner: boolean
  order_date: string; lines: NewOrderLine[]; include: boolean
}

interface CommitResult {
  created: { partners: number; items: number; prices: number; orders: number }
  skipped: { partners: number; items: number; prices: number; orders: number }
  partners: Array<{ id: number; code: string; name: string }>
  items: Array<{ id: number; code: string; name: string; partner_name: string }>
  prices: Array<{ id: number; partner_id: number; item_id: number; sale_price: string; effective_from: string }>
  orders: Array<{ id: number; order_no: string; partner_name: string; lines: number; total: string }>
}

const STATUS_INFO: Record<string, { cls: string; text: string }> = {
  ok:                  { cls: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200', text: '변환됨' },
  skipped_image:       { cls: 'bg-amber-100  text-amber-800   ring-1 ring-amber-200',    text: '이미지' },
  skipped_scanned:     { cls: 'bg-amber-100  text-amber-800   ring-1 ring-amber-200',    text: '스캔본' },
  skipped_unsupported: { cls: 'bg-slate-100  text-slate-700   ring-1 ring-slate-200',    text: '미지원' },
  skipped_reference:   { cls: 'bg-slate-100  text-slate-700   ring-1 ring-slate-200',    text: '참조파일' },
  failed:              { cls: 'bg-rose-100   text-rose-800    ring-1 ring-rose-200',     text: '실패' },
}

export function ConvertTab() {
  const push = useToast((s) => s.push)
  const { token, company } = useAuth()

  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ConvertResult | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [partnerRows, setPartnerRows] = useState<PartnerRow[]>([])
  const [itemRows, setItemRows] = useState<ItemRow[]>([])
  const [priceRows, setPriceRows] = useState<PriceRow[]>([])
  const [orderRows, setOrderRows] = useState<OrderRow[]>([])
  const [committing, setCommitting] = useState(false)
  const [committed, setCommitted] = useState<CommitResult | null>(null)
  const picker = useRef<HTMLInputElement>(null)

  // 변환 결과 바뀌면 4 섹션 상태 초기화
  useEffect(() => {
    setPartnerRows((result?.new_partner_candidates ?? []).map((c) => ({ ...c, include: true })))
    setItemRows((result?.new_item_candidates ?? []).map((c) => ({ ...c, include: true })))
    setPriceRows((result?.new_price_candidates ?? []).map((c) => ({ ...c, include: true })))
    setOrderRows((result?.new_order_candidates ?? []).map((c) => ({ ...c, include: true })))
    setCommitted(null)
  }, [result])

  // 거래처별 그룹화 (품목 섹션용; 신규 먼저 + 한글순)
  const itemsByPartner = itemRows.reduce<
    Map<string, { is_new: boolean; rows: Array<{ row: ItemRow; idx: number }> }>
  >((acc, row, idx) => {
    const key = row.partner_name || '(업장 미상)'
    if (!acc.has(key)) acc.set(key, { is_new: row.is_new_partner, rows: [] })
    acc.get(key)!.rows.push({ row, idx })
    return acc
  }, new Map())
  const itemGroups = Array.from(itemsByPartner.entries()).sort((a, b) => {
    if (a[1].is_new !== b[1].is_new) return a[1].is_new ? -1 : 1
    return a[0].localeCompare(b[0], 'ko')
  })

  function addFiles(list: FileList | File[]) {
    // FileList → Array 즉시 변환 후 push (input.value=''로 인한 race 방지)
    const incoming = Array.from(list)
    if (!incoming.length) return
    setFiles((cur) => {
      const next = [...cur]
      for (const f of incoming) {
        if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f)
      }
      return next
    })
  }
  function removeFile(i: number) { setFiles((cur) => cur.filter((_, idx) => idx !== i)) }
  function reset() {
    setFiles([]); setResult(null); setCommitted(null)
    if (picker.current) picker.current.value = ''
  }

  /** ① 섹션에서 거래처 이름 바뀌면 ②③④의 partner_name도 함께 변경 */
  function renamePartner(oldName: string, newName: string) {
    setPartnerRows((cur) => cur.map((r) => r.name === oldName ? { ...r, name: newName } : r))
    if (oldName === newName) return
    setItemRows((cur) => cur.map((r) => r.partner_name === oldName ? { ...r, partner_name: newName } : r))
    setPriceRows((cur) => cur.map((r) => r.partner_name === oldName ? { ...r, partner_name: newName } : r))
    setOrderRows((cur) => cur.map((r) => r.partner_name === oldName ? { ...r, partner_name: newName } : r))
  }

  /** ② 섹션에서 품목명 바뀌면 ③단가 · ④출고 라인의 item_name도 함께 변경.
   *  (partner_name 기준으로 스코프 — 다른 거래처의 같은 이름 품목은 영향 없음) */
  function renameItem(partnerName: string, oldItemName: string, newItemName: string) {
    setItemRows((cur) => cur.map((r) =>
      r.partner_name === partnerName && r.name === oldItemName
        ? { ...r, name: newItemName } : r,
    ))
    if (oldItemName === newItemName) return
    setPriceRows((cur) => cur.map((r) =>
      r.partner_name === partnerName && r.item_name === oldItemName
        ? { ...r, item_name: newItemName } : r,
    ))
    setOrderRows((cur) => cur.map((order) =>
      order.partner_name !== partnerName ? order : {
        ...order,
        lines: order.lines.map((l) =>
          l.item_name === oldItemName ? { ...l, item_name: newItemName } : l,
        ),
      },
    ))
  }

  /** ② 섹션에서 단위 바뀌면 ④출고 라인의 unit도 함께 변경 */
  function changeItemUnit(partnerName: string, itemName: string, newUnit: string) {
    setItemRows((cur) => cur.map((r) =>
      r.partner_name === partnerName && r.name === itemName
        ? { ...r, unit: newUnit } : r,
    ))
    setOrderRows((cur) => cur.map((order) =>
      order.partner_name !== partnerName ? order : {
        ...order,
        lines: order.lines.map((l) =>
          l.item_name === itemName ? { ...l, unit: newUnit } : l,
        ),
      },
    ))
  }

  async function commitAll() {
    const partners = partnerRows.filter((r) => r.include && r.name.trim())
    const items = itemRows.filter((r) => r.include && r.name.trim())
    const prices = priceRows.filter((r) => r.include)
    const orders = orderRows.filter((r) => r.include && r.lines.length)
    const total = partners.length + items.length + prices.length + orders.length
    if (!total) { push('추가할 항목이 없습니다', 'warn'); return }

    setCommitting(true)
    try {
      const res = await api<CommitResult>('/api/convert/commit', {
        method: 'POST',
        body: {
          partners: partners.map((r) => ({ name: r.name.trim() })),
          items: items.map((r) => ({
            partner_name: r.partner_name, name: r.name.trim(), unit: r.unit.trim(),
          })),
          prices: prices.map((r) => ({
            partner_name: r.partner_name, item_name: r.item_name,
            sale_price: r.sale_price, effective_from: r.effective_from,
          })),
          orders: orders.map((r) => ({
            partner_name: r.partner_name, order_date: r.order_date,
            lines: r.lines,
          })),
        },
      })
      setCommitted(res)
      const parts: string[] = []
      const c = res.created
      if (c.partners) parts.push(`거래처 ${c.partners}건`)
      if (c.items) parts.push(`품목 ${c.items}건`)
      if (c.prices) parts.push(`단가 ${c.prices}건`)
      if (c.orders) parts.push(`출고 ${c.orders}건`)
      const skipTotal = res.skipped.partners + res.skipped.items + res.skipped.prices + res.skipped.orders
      push(
        (parts.length ? `${parts.join(', ')} 추가됨` : '추가 완료')
        + (skipTotal ? ` (중복 ${skipTotal}건 건너뜀)` : ''),
        'success'
      )
    } catch (err) {
      push(`추가 실패: ${err instanceof Error ? err.message : err}`, 'error', 6000)
    } finally {
      setCommitting(false)
    }
  }

  function upload() {
    return new Promise<ConvertResult>((resolve, reject) => {
      const fd = new FormData()
      files.forEach((f) => fd.append('files', f, f.name))
      const xhr = new XMLHttpRequest()
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)) } catch { reject(new Error('응답 파싱 실패')) }
        } else if (xhr.status === 401) reject(new Error('인증 만료'))
        else reject(new Error(`HTTP ${xhr.status}`))
      }
      xhr.onerror = () => reject(new Error('네트워크 오류'))
      xhr.open('POST', '/api/convert')
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      if (company) xhr.setRequestHeader('X-Company-Id', String(company.id))
      xhr.send(fd)
    })
  }

  async function convert() {
    if (!files.length) return
    setLoading(true); setResult(null); setProgress(0)
    try {
      const data = await upload()
      setResult(data)
      const ok = data.summary.filter((r) => r.status === 'ok').length
      const skipped = data.summary.length - ok
      if (data.total_rows > 0) push(`${ok}개 파일에서 ${data.total_rows}행 변환 완료`, 'success')
      else push('변환된 행이 없습니다', 'warn')
      if (skipped > 0) push(`${skipped}개 파일이 처리되지 않았습니다`, 'warn', 5000)
      const parts: string[] = []
      if (data.new_partner_candidates.length) parts.push(`거래처 ${data.new_partner_candidates.length}`)
      if (data.new_item_candidates.length) parts.push(`품목 ${data.new_item_candidates.length}`)
      if (data.new_price_candidates.length) parts.push(`단가 ${data.new_price_candidates.length}`)
      if (data.new_order_candidates.length) parts.push(`출고 ${data.new_order_candidates.length}`)
      if (parts.length) {
        push(`신규 후보 — ${parts.join(' / ')}건. 검토 후 추가하세요`, 'info', 6000)
      }
    } catch (err) {
      push(`오류: ${err instanceof Error ? err.message : err}`, 'error', 6000)
    } finally { setLoading(false) }
  }

  const okFiles = result?.summary.filter((r) => r.status === 'ok') ?? []
  const downloadUrl = result?.download_id ? `/api/convert/download/${result.download_id}` : ''

  function toggle(i: number) {
    setExpanded((cur) => {
      const next = new Set(cur)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">발주서 변환기</h2>
        <p className="text-slate-500 mt-1.5 text-sm leading-relaxed">
          발주서 파일(xlsx · xls · html · pdf)을 업로드하면 표준 양식 엑셀로 합쳐서 다운로드합니다.
          이미지와 스캔 PDF는 처리되지 않습니다.
        </p>
      </header>

      <div
        role="button" tabIndex={0}
        onClick={() => picker.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); picker.current?.click() } }}
        className={cn(
          'block cursor-pointer rounded-2xl border-2 border-dashed px-8 py-12 text-center bg-white transition-colors hover:border-blue-400 focus:outline-none focus:border-blue-500',
          dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300'
        )}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false) }}
      >
        <UploadCloud className="mx-auto w-12 h-12 text-slate-400" />
        <p className="mt-3 text-base font-semibold text-slate-700">여기로 드래그하거나 클릭해서 선택</p>
        <p className="text-sm text-slate-500 mt-1">여러 파일을 한 번에 올릴 수 있습니다.</p>
        <input
          ref={picker} type="file" multiple
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
          accept=".xlsx,.xls,.html,.pdf,.jpg,.jpeg,.png"
          onChange={(e) => {
            const list = e.target.files
            if (list && list.length) addFiles(list)
            e.target.value = ''
          }}
        />
      </div>

      {files.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={f.name + f.size} className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-lg pl-3 pr-2 py-1.5 text-sm shadow-sm">
              <span className="font-medium text-slate-700 truncate max-w-[200px]">{f.name}</span>
              <span className="text-xs text-slate-400 tabular-nums">{(f.size / 1024).toFixed(0)} KB</span>
              <button onClick={() => removeFile(i)} disabled={loading} className="text-slate-400 hover:text-rose-500 disabled:opacity-30 p-0.5 rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button onClick={convert} disabled={!files.length || loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg px-6 py-2.5 text-sm min-w-[110px] inline-flex items-center justify-center gap-2">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="animate-spin h-4 w-4" />
              <span>{progress > 0 && progress < 100 ? `업로드 ${progress}%` : '변환 중...'}</span>
            </span>
          ) : '변환'}
        </button>
        <button onClick={reset} disabled={loading} className="text-slate-600 hover:text-slate-800 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg px-4 py-2 text-sm disabled:opacity-50">
          초기화
        </button>
        <div className="flex-1" />
        {files.length > 0 && <div className="text-sm text-slate-400 tabular-nums">{files.length}개 파일</div>}
      </div>

      {result && (
        <div className="mt-8">
          {result.download_id ? (
            <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 p-5 flex items-center justify-between mb-4 shadow-sm">
              <div>
                <p className="font-semibold text-emerald-900 text-lg">총 {result.total_rows.toLocaleString()}개 행 변환 완료</p>
                <p className="text-sm text-emerald-700/80 mt-1">{okFiles.length}개 파일에서 추출됨</p>
              </div>
              <a href={downloadUrl} download className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg px-5 py-2.5 text-sm inline-flex items-center gap-2 shadow-sm">
                <Download className="w-4 h-4" /> 엑셀 다운로드
              </a>
            </div>
          ) : (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-4 text-amber-900 text-sm">
              변환된 행이 없습니다. 아래 파일별 결과를 확인하세요.
            </div>
          )}

          <ReviewPanel
            committed={committed}
            committing={committing}
            partnerRows={partnerRows} setPartnerRows={setPartnerRows}
            onRenamePartner={renamePartner}
            onRenameItem={renameItem}
            onChangeItemUnit={changeItemUnit}
            itemRows={itemRows} setItemRows={setItemRows}
            itemGroups={itemGroups}
            priceRows={priceRows} setPriceRows={setPriceRows}
            orderRows={orderRows} setOrderRows={setOrderRows}
            itemsMatched={result.items_matched}
            pricesMatched={result.prices_matched}
            onCommit={commitAll}
          />

          <div className="space-y-2">
            {result.summary.map((r, i) => {
              const info = STATUS_INFO[r.status] || { cls: 'bg-slate-100 text-slate-700', text: r.status }
              const isOpen = expanded.has(i)
              return (
                <div key={r.file + i} className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
                  <button
                    onClick={() => r.status === 'ok' && toggle(i)} disabled={r.status !== 'ok'}
                    className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 text-left disabled:cursor-default disabled:hover:bg-white"
                  >
                    <ChevronRight className={cn('w-4 h-4 text-slate-400 shrink-0 transition-transform', isOpen && 'rotate-90')}
                                  style={r.status !== 'ok' ? { opacity: 0 } : {}} />
                    <span className="flex-1 font-medium text-slate-800 truncate">{r.file}</span>
                    <span className="text-sm text-slate-500 truncate max-w-[180px]">{r.business || (r.status === 'ok' ? '—' : '')}</span>
                    <span className="text-xs text-slate-400 tabular-nums w-20 text-right">{r.date || ''}</span>
                    <span className="text-sm font-semibold text-slate-700 tabular-nums w-14 text-right">{r.line_count > 0 ? `${r.line_count}행` : ''}</span>
                    <span className={cn('inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap', info.cls)}>{info.text}</span>
                  </button>
                  {isOpen && r.lines.length > 0 && (
                    <div className="border-t border-slate-100 bg-slate-50 max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="text-xs text-slate-500 uppercase tracking-wide bg-slate-100 sticky top-0">
                          <tr>
                            <th className="text-left px-4 py-2.5 font-medium">품목코드</th>
                            <th className="text-left px-4 py-2.5 font-medium">품명</th>
                            <th className="text-right px-4 py-2.5 font-medium">수량</th>
                            <th className="text-left px-4 py-2.5 font-medium">단위</th>
                            <th className="text-right px-4 py-2.5 font-medium">단가</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.lines.map((l, idx) => (
                            <tr key={idx} className="border-t border-slate-200 hover:bg-white">
                              <td className="px-4 py-2 text-slate-500 text-xs tabular-nums">{l.품목코드 || '—'}</td>
                              <td className="px-4 py-2 text-slate-800">{l.품명}</td>
                              <td className="px-4 py-2 text-right tabular-nums text-slate-700">{formatNum(l.수량 as number)}</td>
                              <td className="px-4 py-2 text-slate-500 text-xs">{l.단위 || ''}</td>
                              <td className="px-4 py-2 text-right tabular-nums text-slate-700">{formatNum(l.단가 as number)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ReviewPanel ───────────────────────────────────────────────────────
interface ReviewProps {
  committed: CommitResult | null
  committing: boolean
  partnerRows: PartnerRow[]; setPartnerRows: React.Dispatch<React.SetStateAction<PartnerRow[]>>
  onRenamePartner: (oldName: string, newName: string) => void
  onRenameItem: (partnerName: string, oldItemName: string, newItemName: string) => void
  onChangeItemUnit: (partnerName: string, itemName: string, newUnit: string) => void
  itemRows: ItemRow[]; setItemRows: React.Dispatch<React.SetStateAction<ItemRow[]>>
  itemGroups: Array<[string, { is_new: boolean; rows: Array<{ row: ItemRow; idx: number }> }]>
  priceRows: PriceRow[]; setPriceRows: React.Dispatch<React.SetStateAction<PriceRow[]>>
  orderRows: OrderRow[]; setOrderRows: React.Dispatch<React.SetStateAction<OrderRow[]>>
  itemsMatched: number; pricesMatched: number
  onCommit: () => void
}

function ReviewPanel(p: ReviewProps) {
  const totalNew = p.partnerRows.length + p.itemRows.length + p.priceRows.length + p.orderRows.length
  if (totalNew === 0 && p.itemsMatched === 0 && p.pricesMatched === 0 && !p.committed) return null

  if (p.committed) {
    const c = p.committed.created
    const s = p.committed.skipped
    const skipTotal = s.partners + s.items + s.prices + s.orders
    return (
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 mb-4 px-4 py-4 text-sm text-emerald-900">
        <div className="font-semibold text-base mb-1">✓ 추가 완료</div>
        <div className="grid grid-cols-4 gap-3 text-center mt-2">
          <Metric label="거래처" n={c.partners}/>
          <Metric label="품목" n={c.items}/>
          <Metric label="단가" n={c.prices}/>
          <Metric label="출고전표" n={c.orders}/>
        </div>
        {skipTotal > 0 && (
          <div className="text-xs text-emerald-700/80 mt-3">
            중복 건너뜀: 거래처 {s.partners}, 품목 {s.items}, 단가 {s.prices}, 출고 {s.orders}
          </div>
        )}
        {p.committed.partners.length > 0 && (
          <div className="text-xs text-emerald-700/80 mt-1.5">
            신규 거래처: {p.committed.partners.map((x) => `${x.code} ${x.name}`).join(', ')}
          </div>
        )}
        {p.committed.orders.length > 0 && (
          <div className="text-xs text-emerald-700/80 mt-1.5">
            출고전표: {p.committed.orders.map((o) => `${o.order_no} (${o.lines}건/${Number(o.total).toLocaleString()}원)`).join(', ')}
          </div>
        )}
      </div>
    )
  }

  const selectedPartners = p.partnerRows.filter((r) => r.include).length
  const selectedItems = p.itemRows.filter((r) => r.include).length
  const selectedPrices = p.priceRows.filter((r) => r.include).length
  const selectedOrders = p.orderRows.filter((r) => r.include).length
  const totalSelected = selectedPartners + selectedItems + selectedPrices + selectedOrders

  return (
    <div className="rounded-xl bg-blue-50/60 border border-blue-200 mb-4 overflow-hidden">
      <div className="px-4 py-3 bg-blue-50 border-b border-blue-200/70">
        <p className="font-semibold text-blue-900 text-sm">
          신규 후보: 거래처 {p.partnerRows.length} · 품목 {p.itemRows.length}
          · 단가 {p.priceRows.length} · 출고 {p.orderRows.length}
          {(p.itemsMatched + p.pricesMatched > 0) && (
            <span className="ml-2 text-xs font-normal text-blue-700/70">
              (기존 매칭: 품목 {p.itemsMatched}, 단가 {p.pricesMatched})
            </span>
          )}
        </p>
        <p className="text-xs text-blue-700/70 mt-0.5">
          섹션별로 검토·수정·체크 후 아래 [확인 추가]를 누르면 모두 한 번에 등록됩니다.
        </p>
      </div>

      {/* 1. 거래처 */}
      <Section title="① 신규 거래처" badgeCls="bg-rose-100 text-rose-700"
               rows={p.partnerRows} onToggleAll={(v) => p.setPartnerRows((cur) => cur.map((r) => ({ ...r, include: v })))}>
        {p.partnerRows.length === 0 ? (
          <Empty>새로 등록할 거래처가 없습니다.</Empty>
        ) : (
          <>
            <div className="px-3 py-1.5 text-[11px] text-blue-700/70 bg-blue-50/50">
              💡 이 칸에서 이름을 바꾸면 ②품목 · ③단가 · ④출고전표에서도 함께 바뀝니다.
            </div>
            <table className="w-full text-sm">
              <tbody>
                {p.partnerRows.map((r, i) => (
                  <SimpleRow key={i} include={r.include}
                             onInclude={(v) => p.setPartnerRows((cur) => cur.map((x, k) => k === i ? { ...x, include: v } : x))}>
                    <td className="px-3 py-1.5">
                      <input value={r.name} disabled={!r.include}
                             onChange={(e) => p.onRenamePartner(r.name, e.target.value)}
                             className="w-full px-2 py-1 border border-transparent hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 rounded text-sm bg-transparent disabled:bg-transparent"/>
                    </td>
                  </SimpleRow>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Section>

      {/* 2. 품목 */}
      <Section title="② 신규 품목 (거래처별)" rows={p.itemRows}
               onToggleAll={(v) => p.setItemRows((cur) => cur.map((r) => ({ ...r, include: v })))}>
        {p.itemRows.length === 0 ? (
          <Empty>새로 등록할 품목이 없습니다.</Empty>
        ) : (
          <>
          <div className="px-3 py-1.5 text-[11px] text-blue-700/70 bg-blue-50/50">
            💡 품목명/단위를 바꾸면 ③단가 · ④출고 라인에서도 함께 바뀝니다.
          </div>
          <div className="max-h-72 overflow-y-auto">
            {p.itemGroups.map(([partnerName, group]) => {
              const allIn = group.rows.every(({ row }) => row.include)
              const anyIn = group.rows.some(({ row }) => row.include)
              return (
                <div key={partnerName} className="border-t border-blue-200/40 first:border-t-0">
                  <div className="px-3 py-1.5 bg-blue-100/40 flex items-center gap-2">
                    <input type="checkbox" checked={allIn}
                           ref={(el) => { if (el) el.indeterminate = !allIn && anyIn }}
                           onChange={(e) => {
                             const v = e.target.checked
                             p.setItemRows((cur) => cur.map((x) => x.partner_name === partnerName ? { ...x, include: v } : x))
                           }}
                           className="w-4 h-4 accent-blue-600"/>
                    <span className="text-xs font-semibold text-blue-900">{partnerName || '(업장 미상)'}</span>
                    {group.is_new && <Badge>신규 거래처</Badge>}
                    <span className="text-[10px] text-blue-700/70 tabular-nums">{group.rows.filter(({ row }) => row.include).length}/{group.rows.length}</span>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {group.rows.map(({ row, idx }) => (
                        <SimpleRow key={idx} include={row.include}
                                   onInclude={(v) => p.setItemRows((cur) => cur.map((x, i) => i === idx ? { ...x, include: v } : x))}>
                          <td className="px-3 py-1.5">
                            <input value={row.name} disabled={!row.include}
                                   onChange={(e) => p.onRenameItem(row.partner_name, row.name, e.target.value)}
                                   className="w-full px-2 py-1 border border-transparent hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 rounded text-sm bg-transparent disabled:bg-transparent"/>
                          </td>
                          <td className="px-3 py-1.5 w-24">
                            <input value={row.unit} disabled={!row.include}
                                   onChange={(e) => p.onChangeItemUnit(row.partner_name, row.name, e.target.value)}
                                   className="w-full px-2 py-1 border border-transparent hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 rounded text-sm bg-transparent disabled:bg-transparent tabular-nums"/>
                          </td>
                        </SimpleRow>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
          </>
        )}
      </Section>

      {/* 3. 단가 */}
      <Section title="③ 거래처별 단가" rows={p.priceRows}
               onToggleAll={(v) => p.setPriceRows((cur) => cur.map((r) => ({ ...r, include: v })))}>
        {p.priceRows.length === 0 ? (
          <Empty>새로 등록할 단가가 없습니다.</Empty>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase text-slate-500 tracking-wide bg-blue-100/40">
                <tr>
                  <th className="px-3 py-1.5 w-10"></th>
                  <th className="text-left px-3 py-1.5">거래처</th>
                  <th className="text-left px-3 py-1.5">품목</th>
                  <th className="text-right px-3 py-1.5 w-24">매출단가</th>
                  <th className="text-left px-3 py-1.5 w-28">적용시작일</th>
                </tr>
              </thead>
              <tbody>
                {p.priceRows.map((r, i) => (
                  <SimpleRow key={i} include={r.include}
                             onInclude={(v) => p.setPriceRows((cur) => cur.map((x, k) => k === i ? { ...x, include: v } : x))}>
                    <td className="px-3 py-1.5 text-xs">{r.partner_name}</td>
                    <td className="px-3 py-1.5 text-xs">{r.item_name}</td>
                    <td className="px-3 py-1.5">
                      <input value={r.sale_price} disabled={!r.include} type="number" step="0.01"
                             onChange={(e) => p.setPriceRows((cur) => cur.map((x, k) => k === i ? { ...x, sale_price: e.target.value } : x))}
                             className="w-full px-2 py-1 border border-transparent hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 rounded text-sm bg-transparent disabled:bg-transparent text-right tabular-nums"/>
                    </td>
                    <td className="px-3 py-1.5">
                      <input value={r.effective_from} disabled={!r.include} type="date"
                             onChange={(e) => p.setPriceRows((cur) => cur.map((x, k) => k === i ? { ...x, effective_from: e.target.value } : x))}
                             className="w-full px-2 py-1 border border-transparent hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 rounded text-sm bg-transparent disabled:bg-transparent tabular-nums"/>
                    </td>
                  </SimpleRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* 4. 출고전표 */}
      <Section title="④ 출고전표" rows={p.orderRows}
               onToggleAll={(v) => p.setOrderRows((cur) => cur.map((r) => ({ ...r, include: v })))}>
        {p.orderRows.length === 0 ? (
          <Empty>새로 등록할 출고전표가 없습니다.</Empty>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase text-slate-500 tracking-wide bg-blue-100/40">
                <tr>
                  <th className="px-3 py-1.5 w-10"></th>
                  <th className="text-left px-3 py-1.5">거래처</th>
                  <th className="text-left px-3 py-1.5 w-28">출고일자</th>
                  <th className="text-right px-3 py-1.5 w-16">라인</th>
                  <th className="text-right px-3 py-1.5 w-24">합계</th>
                </tr>
              </thead>
              <tbody>
                {p.orderRows.map((r, i) => {
                  const total = r.lines.reduce((sum, l) => sum + (Number(l.qty) * Number(l.unit_price)), 0)
                  return (
                    <SimpleRow key={i} include={r.include}
                               onInclude={(v) => p.setOrderRows((cur) => cur.map((x, k) => k === i ? { ...x, include: v } : x))}>
                      <td className="px-3 py-1.5 text-xs">
                        {r.partner_name}
                        {r.is_new_partner && <Badge className="ml-1.5">신규</Badge>}
                      </td>
                      <td className="px-3 py-1.5 text-xs tabular-nums">{r.order_date}</td>
                      <td className="px-3 py-1.5 text-right text-xs tabular-nums">{r.lines.length}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{total.toLocaleString()}</td>
                    </SimpleRow>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="px-4 py-3 bg-white/60 border-t border-blue-200/70 flex items-center gap-3">
        <span className="text-xs text-slate-500 tabular-nums">
          선택: 거래처 {selectedPartners} · 품목 {selectedItems} · 단가 {selectedPrices} · 출고 {selectedOrders}
        </span>
        <div className="flex-1"/>
        <button onClick={p.onCommit} disabled={p.committing || totalSelected === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg px-4 py-2 inline-flex items-center gap-2">
          {p.committing ? <Loader2 className="animate-spin h-4 w-4"/> : <PackagePlus className="w-4 h-4"/>}
          확인 추가 ({totalSelected}건)
        </button>
      </div>
    </div>
  )
}

function Section({
  title, badgeCls, rows, onToggleAll, children,
}: {
  title: string; badgeCls?: string
  rows: { include: boolean }[]
  onToggleAll: (v: boolean) => void
  children: React.ReactNode
}) {
  const allIn = rows.length > 0 && rows.every((r) => r.include)
  const anyIn = rows.some((r) => r.include)
  return (
    <div className="border-t border-blue-200/70 first:border-t-0">
      <div className="px-4 py-2 bg-blue-100/40 flex items-center gap-3">
        <input type="checkbox" checked={allIn} disabled={!rows.length}
               ref={(el) => { if (el) el.indeterminate = !allIn && anyIn }}
               onChange={(e) => onToggleAll(e.target.checked)}
               className="w-4 h-4 accent-blue-600"/>
        <span className={cn('text-sm font-semibold text-blue-900', badgeCls && 'flex items-center gap-2')}>
          {title}
        </span>
        <span className="text-xs text-blue-700/70 tabular-nums">
          {rows.filter((r) => r.include).length} / {rows.length}
        </span>
      </div>
      {children}
    </div>
  )
}

function SimpleRow({
  include, onInclude, children,
}: { include: boolean; onInclude: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <tr className={cn('border-t border-blue-100/40', include ? 'bg-white/60' : 'bg-slate-100/50 text-slate-400')}>
      <td className="px-3 py-1.5 text-center w-10">
        <input type="checkbox" checked={include}
               onChange={(e) => onInclude(e.target.checked)}
               className="w-4 h-4 accent-blue-600"/>
      </td>
      {children}
    </tr>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-3 text-sm text-blue-800/60 italic">{children}</div>
}
