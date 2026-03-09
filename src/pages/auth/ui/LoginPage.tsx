import { useNavigate, useLocation } from 'react-router-dom'
import { LoginForm } from '@/features/auth'
import { Link, Icon } from '@/shared/ui'
import { ROUTES } from '@/shared/constants'
import styles from './AuthPages.module.scss'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? ROUTES.main

  return (
    <main className={styles.page}>
      <div className={styles.box}>
        <h1 className={styles.title}>
          <Icon name="Login" size={28} />
          Вход
        </h1>
        <LoginForm onSuccess={() => navigate(from, { replace: true })} />
        <p className={styles.footer}>
          Нет аккаунта? <Link to={ROUTES.auth.register}>Зарегистрироваться</Link>
        </p>
      </div>
    </main>
  )
}
