import { Link, Icon } from '@/shared/ui'
import { ROUTES } from '@/shared/constants'

export function AuthPage() {
  return (
    <main>
      <h1>Вход / Регистрация</h1>
      <p>
        <Link to={ROUTES.auth.login}>
          <Icon name="Login" size={18} />
          Вход
        </Link>
        {' · '}
        <Link to={ROUTES.auth.register}>Регистрация</Link>
      </p>
    </main>
  )
}
