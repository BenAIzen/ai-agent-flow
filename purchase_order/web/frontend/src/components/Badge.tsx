import { cn } from '@/lib/utils'

/** 작은 라벨 배지 (신규/매출처/매입처 등). 기본은 rose 톤. */
export function Badge({
  children, className,
}: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn(
      'text-[10px] font-bold px-1.5 py-0.5 rounded ring-1',
      'bg-rose-100 text-rose-700 ring-rose-200',
      className,
    )}>
      {children}
    </span>
  )
}

/** 수치 카드 (commit 완료 후 추가 카운트 표시 등). */
export function Metric({ label, n }: { label: string; n: number }) {
  return (
    <div className="bg-white/60 rounded-lg py-2 text-center">
      <div className="text-xs text-emerald-700/70">{label}</div>
      <div className="text-xl font-bold tabular-nums">{n}</div>
    </div>
  )
}
