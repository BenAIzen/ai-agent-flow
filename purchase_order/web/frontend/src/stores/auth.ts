import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: number
  username: string
  display_name: string | null
  default_company_id: number | null
}

export interface Company {
  id: number
  name: string
  biz_no: string | null
  rep_name: string | null
  biz_type: '법인' | '개인'
  is_default: boolean
  is_active: boolean
}

interface AuthState {
  token: string | null
  user: User | null
  company: Company | null

  setToken: (t: string | null) => void
  setUser: (u: User | null) => void
  setCompany: (c: Company | null) => void
  logout: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      company: null,
      setToken: (t) => set({ token: t }),
      setUser: (u) => set({ user: u }),
      setCompany: (c) => set({ company: c }),
      logout: () => set({ token: null, user: null, company: null }),
    }),
    { name: 'gf-auth' }
  )
)
