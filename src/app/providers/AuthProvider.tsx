import { useEffect, type ReactNode } from 'react'
import { getCurrentUser } from '@/entities/user'
import { useAuthStore } from '../store'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const setUser = useAuthStore((s) => s.setUser)
  const setAuthChecked = useAuthStore((s) => s.setAuthChecked)

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        setUser(user)
      })
      .finally(() => {
        setAuthChecked(true)
      })
  }, [setUser, setAuthChecked])

  return <>{children}</>
}
