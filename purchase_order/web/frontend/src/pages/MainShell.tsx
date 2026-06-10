import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'

import { useAuth } from '@/stores/auth'
import { cn } from '@/lib/utils'

const TABS = [
  { path: '/main',             label: 'PO 변환' },
  { path: '/main/partners',    label: '거래처관리' },
  { path: '/main/items',       label: '품목관리' },
  { path: '/main/prices',      label: '거래처별 단가' },
  { path: '/main/delivery',    label: '출고처리' },
  { path: '/main/collections', label: '수금등록' },
  { path: '/main/payments',    label: '지급등록' },
  { path: '/main/invoice',     label: '거래명세서' },
  { path: '/main/ledger',      label: '채권채무집계' },
]

export function MainShell() {
  const nav = useNavigate()
  const path = useRouterState({ select: (s) => s.location.pathname })
  const { user, company, logout, setCompany } = useAuth()

  function doLogout() {
    logout()
    nav({ to: '/login' })
  }

  function switchCompany() {
    setCompany(null)
    nav({ to: '/company-select' })
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col no-print">
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="text-xs text-slate-400 uppercase tracking-wide font-semibold">현재 회사</div>
          <div className="font-semibold text-slate-900 text-sm mt-1 truncate">{company?.name || '—'}</div>
          <button onClick={switchCompany}
                  className="text-xs text-blue-600 hover:text-blue-800 mt-1">
            회사 변경 →
          </button>
        </div>

        <nav className="p-3 flex-1 overflow-y-auto">
          {TABS.map((t) => {
            const active = t.path === '/main' ? path === '/main' : path.startsWith(t.path)
            return (
              <Link
                key={t.path}
                to={t.path}
                className={cn(
                  'block w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium',
                  'transition-colors mb-0.5',
                  active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                {t.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <div className="text-xs text-slate-500 px-2 mb-1.5">{user?.display_name || user?.username}</div>
          <button onClick={doLogout}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-md">
            로그아웃
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
