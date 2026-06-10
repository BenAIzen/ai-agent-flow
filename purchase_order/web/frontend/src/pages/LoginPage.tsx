import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'

import { api } from '@/api/client'
import { useAuth, type Company, type User } from '@/stores/auth'

export function LoginPage() {
  const nav = useNavigate()
  const { setToken, setUser, setCompany } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const tok = await api<{ access_token: string }>(
        '/api/auth/login',
        { method: 'POST', body: { username, password }, noAuth: true }
      )
      setToken(tok.access_token)

      const user = await api<User>('/api/auth/me')
      setUser(user)

      // 기본 회사가 있으면 바로 진입
      if (user.default_company_id) {
        const list = await api<Company[]>('/api/companies')
        const c = list.find((x) => x.id === user.default_company_id)
        if (c) {
          setCompany(c)
          nav({ to: '/main' })
          return
        }
      }
      nav({ to: '/company-select' })
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
        <div className="text-center mb-7">
          <div className="inline-flex w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700
                          items-center justify-center text-xl font-bold mb-3">G</div>
          <h1 className="text-2xl font-bold text-slate-900">그린푸드 ERP</h1>
          <p className="text-sm text-slate-500 mt-1">로그인이 필요합니다</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">아이디</label>
            <input
              type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              autoFocus required autoComplete="username"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300
                         focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100
                         text-sm outline-none transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">비밀번호</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required autoComplete="current-password"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300
                         focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100
                         text-sm outline-none transition"
            />
          </div>

          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300
                       text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
          >
            {loading ? '접속 중...' : '로그인'}
          </button>
        </form>

        <p className="text-xs text-slate-400 text-center mt-6 leading-relaxed">
          처음 사용 시 기본 계정: <code className="bg-slate-100 px-1.5 py-0.5 rounded">admin / admin1234</code>
        </p>
      </div>
    </div>
  )
}
