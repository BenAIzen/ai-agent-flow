import { useRef, useState } from 'react'
import { ChevronRight, Download, Loader2, UploadCloud, X } from 'lucide-react'

import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'
import { cn, formatNum } from '@/lib/utils'

interface Line {
  품목코드?: string; 품명?: string; 수량?: string | number; 단위?: string; 단가?: string | number
}
interface SummaryEntry {
  file: string; status: string; date: string; business: string
  line_count: number; lines: Line[]
}
interface ConvertResult {
  summary: SummaryEntry[]; download_id: string; total_rows: number
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
  const picker = useRef<HTMLInputElement>(null)

  function addFiles(list: FileList) {
    setFiles((cur) => {
      const next = [...cur]
      for (const f of Array.from(list)) {
        if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f)
      }
      return next
    })
  }
  function removeFile(i: number) { setFiles((cur) => cur.filter((_, idx) => idx !== i)) }
  function reset() { setFiles([]); setResult(null); if (picker.current) picker.current.value = '' }

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

      <label
        className={cn(
          'block cursor-pointer rounded-2xl border-2 border-dashed px-8 py-12 text-center bg-white transition-colors hover:border-blue-400',
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
          ref={picker} type="file" multiple className="hidden"
          accept=".xlsx,.xls,.html,.pdf,.jpg,.jpeg,.png"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }}
        />
      </label>

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
