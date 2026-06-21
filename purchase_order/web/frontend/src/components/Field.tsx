/** 폼 필드 라벨 + 슬롯. 모든 탭에서 같은 모양으로 입력 필드 감쌈. */
export function Field({
  label, children, full,
}: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : undefined}>
      <label className="text-xs font-semibold text-slate-600 mb-1 block">{label}</label>
      {children}
    </div>
  )
}

/** 모든 텍스트/숫자 입력 공통 클래스. */
export const inputCls =
  'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

/** select 공통 클래스 (배경색 추가). */
export const selectCls = inputCls + ' bg-white'
