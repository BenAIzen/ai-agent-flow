import { create } from 'zustand'

export type ToastKind = 'success' | 'warn' | 'error' | 'info'

export interface Toast {
  id: number
  message: string
  kind: ToastKind
}

interface ToastState {
  items: Toast[]
  push: (message: string, kind?: ToastKind, ttl?: number) => void
  remove: (id: number) => void
}

let counter = 0
export const useToast = create<ToastState>((set) => ({
  items: [],
  push: (message, kind = 'info', ttl = 3500) => {
    const id = ++counter
    set((s) => ({ items: [...s.items, { id, message, kind }] }))
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), ttl)
  },
  remove: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}))
