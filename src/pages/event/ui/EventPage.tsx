import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Link } from '@/shared/ui'
import { getEventById } from '@/entities/event'
import { EventPreview } from '@/entities/event'
import { getMyApplications } from '@/entities/application'
import { ApplyToEventButton } from '@/features/apply-to-event'
import { useAuthStore } from '@/app/store'
import { ROUTES } from '@/shared/constants'
import { Spinner } from '@/shared/ui'
import styles from './EventPage.module.scss'

export function EventPage() {
  const { id } = useParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)
  const [event, setEvent] = useState<Awaited<ReturnType<typeof getEventById>> | null>(null)
  const [hasApplication, setHasApplication] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      queueMicrotask(() => setLoading(false))
      return
    }
    let cancelled = false
    queueMicrotask(() => setLoading(true))
    getEventById(id)
      .then((data) => { if (!cancelled) { setError(null); setEvent(data) } })
      .catch(() => { if (!cancelled) setError('Мероприятие не найдено') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (!user || !id) {
      queueMicrotask(() => setHasApplication(false))
      return
    }
    let cancelled = false
    getMyApplications()
      .then((list) => {
        if (!cancelled) setHasApplication(list.some((app) => app.eventId === id))
      })
      .catch(() => { if (!cancelled) setHasApplication(false) })
    return () => { cancelled = true }
  }, [user, id])

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
      <Link to={ROUTES.events} className={styles.back}>
        ← К каталогу
      </Link>
      <EventPreview event={event} className={styles.preview} />
      {event.status === 'published' && !hasApplication && user?.role === 'volunteer' && (
        <div className={styles.apply}>
          <ApplyToEventButton event={event} onSuccess={() => setHasApplication(true)} />
        </div>
      )}
    </main>
  )
}
