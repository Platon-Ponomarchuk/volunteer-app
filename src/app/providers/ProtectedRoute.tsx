import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store'
import { ROUTES } from '@/shared/constants'
import { Spinner } from '@/shared/ui'

interface ProtectedRouteProps {
  children: React.ReactNode
  /** Требуемая роль; если не указана — достаточно быть авторизованным */
  role?: 'volunteer' | 'organizer' | 'admin'
}

export function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const user = useAuthStore((s) => s.user)
  const authChecked = useAuthStore((s) => s.authChecked)
  const location = useLocation()

  if (!authChecked) {
    return <Spinner />
  }

  if (!user) {
    return <Navigate to={ROUTES.auth.login} state={{ from: location }} replace />
  }

  if (role && user.role !== role && user.role !== 'admin') {
    return <Navigate to={ROUTES.main} replace />
  }

  return <>{children}</>
}
