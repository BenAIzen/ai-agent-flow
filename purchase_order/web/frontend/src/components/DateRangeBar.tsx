/** 기간 필터 입력 (from/to). 우측에 children 슬롯으로 검색박스/카운트 등 배치. */
export function DateRangeBar({
  from, to, onFrom, onTo, children,
}: {
  from: string; to: string
  onFrom: (v: string) => void; onTo: (v: string) => void
  children?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 mb-3 flex items-center gap-3 flex-wrap">
      <label className="text-xs font-semibold text-slate-500">기간</label>
      <input type="date" value={from} onChange={(e) => onFrom(e.target.value)}
             className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm tabular-nums"/>
      <span className="text-slate-400">~</span>
      <input type="date" value={to} onChange={(e) => onTo(e.target.value)}
             className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm tabular-nums"/>
      {children}
    </div>
  )
}
