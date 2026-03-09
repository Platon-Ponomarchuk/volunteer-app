import { useState } from 'react'
import { Link, Button, Icon } from '@/shared/ui'
import { ROUTES } from '@/shared/constants'
import { useThemeStore } from '@/app/store'
import type { User } from '@/entities/user'
import styles from './Header.module.scss'

interface HeaderProps {
  user: User | null
}

function ThemeToggle({ inDrawer }: { inDrawer?: boolean }) {
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const isDark = theme === 'dark'
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className={inDrawer ? styles.themeToggleDrawer : styles.themeToggleNav}
      aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
      title={isDark ? 'Светлая тема' : 'Тёмная тема'}
    >
      <Icon name={isDark ? 'Light' : 'Dark'} size={20} />
      {inDrawer ? (isDark ? 'Светлая тема' : 'Тёмная тема') : null}
    </Button>
  )
}

// Основная навигация: Главная, Заявки, Мероприятия
function NavSection({
  user,
  className,
}: {
  user: User | null
  className?: string
}) {
  return (
    <div className={className ?? styles.navSection}>
      <Link to={ROUTES.main}>Главная</Link>
      {user && <Link to={ROUTES.myApplications}>Заявки</Link>}
      <Link to={ROUTES.events}>Мероприятия</Link>
      {user?.role === 'admin' && <Link to={ROUTES.admin}>Админка</Link>}
    </div>
  )
}

// Блок справа: тема, уведомления (иконка), профиль / вход
function ActionsSection({
  user,
  inDrawer,
}: {
  user: User | null
  inDrawer?: boolean
}) {
  return (
    <div className={inDrawer ? styles.actionsDrawer : styles.actionsSection}>
      <ThemeToggle inDrawer={inDrawer} />
      {user ? (
        <>
          <Link
            to={ROUTES.notifications}
            className={inDrawer ? styles.drawerIconLink : styles.iconLink}
            aria-label="Уведомления"
            title="Уведомления"
          >
            <Icon name="BellOn" size={20} />
            {inDrawer ? 'Уведомления' : null}
          </Link>
          <Link
            to={ROUTES.profile}
            className={inDrawer ? styles.drawerIconLink : styles.iconLink}
            aria-label="Профиль"
            title="Профиль"
          >
            <Icon name="User" size={20} />
            {inDrawer ? 'Профиль' : null}
          </Link>
        </>
      ) : (
        <Link to={ROUTES.auth.login} className={styles.linkWithIcon}>
          <Icon name="Login" size={20} />
          Вход
        </Link>
      )}
    </div>
  )
}

export function Header({ user }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => setMenuOpen(false)

  return (
    <>
      <header className={styles.header}>
        <nav className={styles.nav}>
          <NavSection user={user} className={styles.navSectionDesktop} />
          <ActionsSection user={user} />

          <button
            type="button"
            className={styles.menuToggle}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={menuOpen}
          >
            <svg
              className={styles.menuIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              {menuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </nav>
      </header>

      <div
        className={`${styles.menuOverlay} ${menuOpen ? styles.open : ''}`}
        onClick={closeMenu}
        aria-hidden
      />
      <div className={`${styles.menuDrawer} ${menuOpen ? styles.open : ''}`}>
        <NavSection user={user} className={styles.drawerSection} />
        <ActionsSection user={user} inDrawer />
      </div>
    </>
  )
}
