import { Link } from '@/shared/ui'
import { ROUTES } from '@/shared/constants'
import styles from './Footer.module.scss'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className={styles.footer}>
      <div className={styles.content}>
        <div className={styles.links}>
          <Link to={ROUTES.main} variant="muted">
            Главная
          </Link>
          <Link to={ROUTES.events} variant="muted">
            Мероприятия
          </Link>
        </div>
        <p className={styles.copyright}>© {currentYear} Волонтёры. Координация добровольцев.</p>
      </div>
    </footer>
  )
}
