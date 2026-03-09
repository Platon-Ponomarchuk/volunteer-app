import { Outlet } from 'react-router-dom'
import { Header } from '@/widgets/header'
import { Footer } from '@/widgets/footer'
import { useAuthStore } from './store'
import styles from './Layout.module.scss'

export function Layout() {
  const user = useAuthStore((s) => s.user)

  return (
    <div className={styles.layout}>
      <Header user={user} />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
