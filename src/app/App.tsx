import { ToastContainer } from '@/shared/ui'
import { AuthProvider } from './providers'
import { Router } from './router'

export function App() {
  return (
    <AuthProvider>
      <Router />
      <ToastContainer />
    </AuthProvider>
  )
}
