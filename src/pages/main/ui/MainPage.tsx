import { useState, useEffect } from 'react'
import { Link, Button } from '@/shared/ui'
import { EventList } from '@/widgets/event-list'
import { getPopularEvents } from '@/entities/event'
import { getOrganizers, OrganizerCard } from '@/entities/user'
import { ROUTES } from '@/shared/constants'
import type { Event } from '@/entities/event'
import type { User } from '@/entities/user'
import styles from './MainPage.module.scss'

export function MainPage() {
  const [events, setEvents] = useState<Event[] | undefined>(undefined)
  const [organizers, setOrganizers] = useState<User[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [organizersLoading, setOrganizersLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getPopularEvents(6)
      .then((data) => { if (!cancelled) setEvents(data) })
      .finally(() => { if (!cancelled) setEventsLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    getOrganizers(6)
      .then((data) => { if (!cancelled) setOrganizers(data) })
      .finally(() => { if (!cancelled) setOrganizersLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-label="Главный экран">
        <div className={styles.heroOverlay} aria-hidden />
        <div className={styles.heroContent}>
          <h1 className={styles.title}>Волонтёры</h1>
          <p className={styles.subtitle}>
            Веб-сервис координации добровольцев: находите мероприятия и организаторов
          </p>
          <Link to={ROUTES.events}>
            <Button variant="primary" size="lg" className={styles.heroCta}>
              Смотреть мероприятия
            </Button>
          </Link>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Популярные мероприятия</h2>
          <Link to={ROUTES.events} className={styles.link}>
            Все мероприятия →
          </Link>
        </div>
        <EventList
          events={events}
          loading={eventsLoading}
          emptyMessage="Пока нет мероприятий"
          className={styles.eventGrid}
        />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Лучшие организаторы</h2>
        </div>
        {organizersLoading ? (
          <p className={styles.loading}>Загрузка...</p>
        ) : organizers.length === 0 ? (
          <p className={styles.empty}>Пока нет организаторов</p>
        ) : (
          <ul className={styles.organizerList}>
            {organizers.slice(0, 6).map((org) => (
              <li key={org.id}>
                <OrganizerCard organizer={org} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
