interface Props { label: string }

export function Placeholder({ label }: Props) {
  return (
    <div className="max-w-xl mx-auto py-20 text-center">
      <div className="text-5xl mb-3">🚧</div>
      <h2 className="text-xl font-semibold text-slate-700">{label}</h2>
      <p className="text-sm text-slate-500 mt-2">곧 구현됩니다.</p>
    </div>
  )
}
