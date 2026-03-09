import { useAuthStore } from '@/app/store'
import { NotificationList } from '@/features/notifications'
import { Icon } from '@/shared/ui'
import styles from './NotificationsPage.module.scss'

export function NotificationsPage() {
  const user = useAuthStore((s) => s.user)

  if (!user) {
    return null
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>
        <Icon name="BellOn" size={28} />
        Уведомления
      </h1>
      <NotificationList userId={user.id} />
    </main>
  )
}
