import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  Apple, ArrowLeftRight, CreditCard, FileText,
  Leaf, LogOut, Package, Scale, Tag, Users, Wallet,
} from 'lucide-react'

import { useAuth } from '@/stores/auth'
import { cn } from '@/lib/utils'

const TABS = [
  { path: '/main',             label: 'PO 변환',       Icon: ArrowLeftRight },
  { path: '/main/partners',    label: '거래처관리',     Icon: Users },
  { path: '/main/items',       label: '품목관리',       Icon: Apple },
  { path: '/main/prices',      label: '거래처별 단가',  Icon: Tag },
  { path: '/main/delivery',    label: '출고처리',       Icon: Package },
  { path: '/main/collections', label: '수금등록',       Icon: Wallet },
  { path: '/main/payments',    label: '지급등록',       Icon: CreditCard },
  { path: '/main/invoice',     label: '거래명세서',     Icon: FileText },
  { path: '/main/ledger',      label: '채권채무집계',   Icon: Scale },
] as const

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
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col no-print">
        {/* 브랜드 */}
        <div className="px-5 py-5 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
              <Leaf className="w-5 h-5" strokeWidth={2.4}/>
            </div>
            <div>
              <div className="font-bold text-base tracking-tight leading-tight">그린푸드</div>
              <div className="text-[10px] text-emerald-100/90 uppercase tracking-widest">Fresh Produce ERP</div>
            </div>
          </div>
        </div>

        {/* 현재 회사 */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-emerald-50/40">
          <div className="text-[10px] text-emerald-700/70 uppercase tracking-wider font-bold">현재 회사</div>
          <div className="font-semibold text-slate-900 text-sm mt-0.5 truncate">{company?.name || '—'}</div>
          <button onClick={switchCompany}
                  className="text-xs text-emerald-700 hover:text-emerald-900 mt-1 font-medium">
            회사 변경 →
          </button>
        </div>

        {/* 탭 메뉴 */}
        <nav className="p-3 flex-1 overflow-y-auto">
          {TABS.map(({ path: p, label, Icon }) => {
            const active = p === '/main' ? path === '/main' : path.startsWith(p)
            return (
              <Link
                key={p}
                to={p}
                className={cn(
                  'flex items-center gap-2.5 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium',
                  'transition-all mb-0.5',
                  active
                    ? 'bg-emerald-100/80 text-emerald-800 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-emerald-700' : 'text-slate-400')}/>
                <span className="truncate">{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* 사용자 */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold ring-1 ring-emerald-200">
              {(user?.display_name || user?.username || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-700 truncate">{user?.display_name || user?.username}</div>
            </div>
            <button onClick={doLogout} title="로그아웃"
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors">
              <LogOut className="w-4 h-4"/>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
