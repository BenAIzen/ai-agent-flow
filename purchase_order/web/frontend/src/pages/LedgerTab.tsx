import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Scale } from 'lucide-react'

import { api } from '@/api/client'
import type { LedgerResponse } from '@/types/models'
import { cn, firstOfMonthISO, formatNum, todayISO } from '@/lib/utils'

type Mode = 'receivable' | 'payable'

export function LedgerTab() {
  const [mode, setMode] = useState<Mode>('receivable')
  const [dateFrom, setDateFrom] = useState(firstOfMonthISO())
  const [dateTo, setDateTo] = useState(todayISO())

  const { data } = useQuery({
    queryKey: ['ledger', mode, dateFrom, dateTo],
    queryFn: () => api<LedgerResponse>(`/api/ledger/${mode}?from=${dateFrom}&to=${dateTo}`),
  })

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-5 flex items-start gap-3">
        <Scale className="w-6 h-6 text-emerald-600 mt-0.5"/>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">채권채무집계</h2>
          <p className="text-sm text-slate-500 mt-1">
            거래처별 잔액 = 전월이월 + 당기발생 − 당기수금/지급
          </p>
        </div>
      </header>

      <div className="bg-white rounded-xl border border-slate-200 p-3 mb-3 flex items-center gap-3 flex-wrap">
        <div className="inline-flex rounded-lg overflow-hidden border border-slate-300">
          <button onClick={() => setMode('receivable')}
                  className={cn('px-3 py-2 text-sm font-semibold transition',
                    mode === 'receivable' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50')}>
            채권 (매출처)
          </button>
          <button onClick={() => setMode('payable')}
                  className={cn('px-3 py-2 text-sm font-semibold transition',
                    mode === 'payable' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50')}>
            채무 (매입처)
          </button>
        </div>

        <label className="text-xs font-semibold text-slate-500 ml-3">기간</label>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
               className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm tabular-nums"/>
        <span className="text-slate-400">~</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
               className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm tabular-nums"/>

        <span className="ml-auto text-xs text-slate-400 tabular-nums">
          {data ? `${data.rows.length}건` : ''}
        </span>
      </div>

      {data && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wide">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium w-24">코드</th>
                <th className="px-3 py-2.5 text-left font-medium">거래처</th>
                <th className="px-3 py-2.5 text-right font-medium w-32">전월이월</th>
                <th className="px-3 py-2.5 text-right font-medium w-32">
                  {mode === 'receivable' ? '당기발생(매출)' : '당기발생(매입)'}
                </th>
                <th className="px-3 py-2.5 text-right font-medium w-32">
                  {mode === 'receivable' ? '당기수금' : '당기지급'}
                </th>
                <th className="px-3 py-2.5 text-right font-medium w-32">
                  {mode === 'receivable' ? '잔액(미수액)' : '잔액(미지급)'}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const balance = Number(r.balance)
                return (
                  <tr key={r.partner_id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-xs text-slate-500 tabular-nums">{r.partner_code}</td>
                    <td className="px-3 py-2 font-medium">{r.partner_name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{formatNum(r.opening)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatNum(mode === 'receivable' ? r.sales : r.purchases)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                      {formatNum(mode === 'receivable' ? r.received : r.paid)}
                    </td>
                    <td className={cn('px-3 py-2 text-right tabular-nums font-bold',
                      mode === 'receivable'
                        ? balance > 0 ? 'text-rose-700' : balance < 0 ? 'text-emerald-700' : 'text-slate-400'
                        : balance < 0 ? 'text-purple-700' : 'text-slate-400')}>
                      {formatNum(r.balance)}
                    </td>
                  </tr>
                )
              })}
              {!data.rows.length && (
                <tr><td colSpan={6} className="text-center text-slate-400 py-10 text-sm">이 기간에 거래내역이 없습니다.</td></tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50 font-bold">
              <tr>
                <td colSpan={2} className="px-3 py-2 text-right text-xs text-slate-600">합 계</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNum(data.totals.opening)}</td>
                <td className={cn('px-3 py-2 text-right tabular-nums',
                  mode === 'receivable' ? 'text-emerald-700' : 'text-slate-700')}>
                  {formatNum(mode === 'receivable' ? data.totals.sales : data.totals.purchases)}
                </td>
                <td className={cn('px-3 py-2 text-right tabular-nums',
                  mode === 'receivable' ? 'text-blue-700' : 'text-purple-700')}>
                  {formatNum(mode === 'receivable' ? data.totals.received : data.totals.paid)}
                </td>
                <td className={cn('px-3 py-2 text-right tabular-nums',
                  mode === 'receivable' ? 'text-rose-700' : 'text-purple-700')}>
                  {formatNum(data.totals.balance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
