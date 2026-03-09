import { useNavigate } from 'react-router-dom'
import { RegisterForm } from '@/features/auth'
import { Link, Icon } from '@/shared/ui'
import { ROUTES } from '@/shared/constants'
import styles from './AuthPages.module.scss'

export function RegisterPage() {
  const navigate = useNavigate()

  return (
    <main className={styles.page}>
      <div className={styles.box}>
        <h1 className={styles.title}>
          <Icon name="User" size={28} />
          Регистрация
        </h1>
        <RegisterForm onSuccess={() => navigate(ROUTES.main, { replace: true })} />
        <p className={styles.footer}>
          Уже есть аккаунт? <Link to={ROUTES.auth.login} className={styles.linkWithIcon}>
            <Icon name="Login" size={18} />
            Войти
          </Link>
        </p>
      </div>
    </main>
  )
}
