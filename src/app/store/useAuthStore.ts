import { create } from 'zustand'
import { logout as clearAuthStorage, type User } from '@/entities/user'

interface AuthState {
  user: User | null
  authChecked: boolean
  setUser: (user: User | null) => void
  setAuthChecked: (checked: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  authChecked: false,
  setUser: (user) => set({ user }),
  setAuthChecked: (authChecked) => set({ authChecked }),
  logout: () => {
    clearAuthStorage()
    set({ user: null })
  },
}))
