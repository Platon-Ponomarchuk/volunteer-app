import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Link } from '@/shared/ui'
import { getEventById } from '@/entities/event'
import { getApplicationsByEventId } from '@/entities/application'
import { EventPreview } from '@/entities/event'
import { ApplicationActions } from '@/features/manage-application'
import { ROUTES } from '@/shared/constants'
import { Spinner } from '@/shared/ui'
import type { Application } from '@/entities/application'
import styles from './ManageEventPage.module.scss'

export function ManageEventPage() {
  const { id } = useParams<{ id: string }>()
  const [event, setEvent] = useState<Awaited<ReturnType<typeof getEventById>> | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadApplications = () => {
    if (!id) return
    getApplicationsByEventId(id).then(setApplications)
  }

  useEffect(() => {
    if (!id) {
      queueMicrotask(() => setLoading(false))
      return
    }
    let cancelled = false
    queueMicrotask(() => setLoading(true))
    getEventById(id)
      .then((e) => {
        if (!cancelled) { setError(null); setEvent(e) }
        return id ? getApplicationsByEventId(id) : []
      })
      .then((list) => { if (!cancelled) setApplications(list) })
      .catch(() => { if (!cancelled) setError('Мероприятие не найдено') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <main className={styles.page}>
        <Spinner />
      </main>
    )
  }

  if (error || !event) {
    return (
      <main className={styles.page}>
        <p className={styles.error}>{error ?? 'Мероприятие не найдено'}</p>
        <Link to={ROUTES.events}>К каталогу</Link>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <Link to={ROUTES.eventById(event.id)} className={styles.back}>
        ← К мероприятию
      </Link>
      <h1 className={styles.title}>Управление мероприятием</h1>
      <EventPreview event={event} className={styles.preview} />
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Заявки ({applications.length})</h2>
        {applications.length === 0 ? (
          <p className={styles.empty}>Пока нет заявок</p>
        ) : (
          <ul className={styles.list}>
            {applications.map((app) => (
              <li key={app.id} className={styles.item}>
                <div className={styles.itemMain}>
                  <span className={styles.userName}>{app.userName ?? `Пользователь #${app.userId}`}</span>
                  <span className={styles.status} data-status={app.status}>
                    {app.status === 'pending' ? 'На рассмотрении' : app.status === 'approved' ? 'Подтверждена' : 'Отклонена'}
                  </span>
                </div>
                {app.message && <p className={styles.message}>{app.message}</p>}
                <ApplicationActions application={app} onUpdated={loadApplications} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
