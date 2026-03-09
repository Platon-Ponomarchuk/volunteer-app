import { useNavigate } from 'react-router-dom'
import { Card } from '@/shared/ui'
import { CreateEventForm } from '@/features/create-event'
import { ROUTES } from '@/shared/constants'
import styles from './CreateEventPage.module.scss'

export function CreateEventPage() {
  const navigate = useNavigate()

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Создание мероприятия</h1>
      <Card padding="lg" className={styles.card}>
        <CreateEventForm onSuccess={() => navigate(ROUTES.events, { replace: true })} />
      </Card>
    </main>
  )
}
