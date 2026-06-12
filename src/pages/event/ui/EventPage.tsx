import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Link, StateBlock } from '@/shared/ui'
import { getEventById } from '@/entities/event'
import { getMyApplications } from '@/entities/application'
import { ApplyToEventButton } from '@/features/apply-to-event'
import { useAuthStore } from '@/app/store'
import { ROUTES } from '@/shared/constants'
import { Spinner } from '@/shared/ui'
import { formatDate, formatDateTime } from '@/shared/lib'
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
      <article className={styles.event}>
        <div className={styles.hero}>
          {event.imageUrl ? (
            <img src={event.imageUrl} alt="" className={styles.heroImage} />
          ) : (
            <div className={styles.heroPlaceholder} aria-hidden>
              {event.title.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className={styles.contentGrid}>
          <section className={styles.mainContent}>
            <span className={styles.category}>{event.categoryName ?? 'Мероприятие'}</span>
            <h1 className={styles.title}>{event.title}</h1>
            <p className={styles.description}>{event.description}</p>
            {event.roles && event.roles.length > 0 && (
              <section className={styles.roles}>
                <h2>Роли для волонтёров</h2>
                <ul>
                  {event.roles.map((role) => (
                    <li key={role.id}>
                      <strong>{role.name}</strong>
                      <span>{role.requiredCount} чел.</span>
                      {role.description && <p>{role.description}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </section>
          <aside className={styles.sidebar}>
            <dl className={styles.meta}>
              <div>
                <dt>Дата</dt>
                <dd>{event.endDate ? `${formatDate(event.date)} — ${formatDate(event.endDate)}` : formatDateTime(event.date)}</dd>
              </div>
              <div>
                <dt>Место</dt>
                <dd>{event.location}</dd>
              </div>
              {event.city && (
                <div>
                  <dt>Город</dt>
                  <dd>{event.city}</dd>
                </div>
              )}
              {event.schedule && (
                <div>
                  <dt>Расписание</dt>
                  <dd>{event.schedule}</dd>
                </div>
              )}
              {event.organizerName && (
                <div>
                  <dt>Организатор</dt>
                  <dd>{event.organizerName}</dd>
                </div>
              )}
            </dl>
            {event.status === 'published' && hasApplication && user?.role === 'volunteer' && (
              <StateBlock title="Вы уже записались" description="Заявка отображается в разделе «Мои заявки»." tone="success" icon="CircleCheck" className={styles.applyState} />
            )}
            {event.status === 'published' && !hasApplication && user?.role === 'volunteer' && (
              <div className={styles.apply}>
                <ApplyToEventButton event={event} onSuccess={() => setHasApplication(true)} />
              </div>
            )}
          </aside>
        </div>
      </article>
    </main>
  )
}
