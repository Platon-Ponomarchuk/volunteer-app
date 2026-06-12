import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyApplications, getApplicationsByEventId } from '@/entities/application'
import { getMyEventRequests } from '@/entities/event-request'
import { ApplicationList } from '@/widgets/application-list'
import { EventRequestList } from '@/widgets/event-request-list'
import { VolunteerCalendar } from '@/widgets/volunteer-calendar'
import { Button, StateBlock } from '@/shared/ui'
import { ROUTES } from '@/shared/constants'
import { useAuthStore } from '@/app/store'
import styles from './MyApplicationsPage.module.scss'

type EventStats = Record<string, { maxVolunteers: number; approvedCount: number }>
type ApplicationsTab = 'list' | 'calendar'

export function MyApplicationsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [applications, setApplications] = useState<Awaited<ReturnType<typeof getMyApplications>>>([])
  const [eventRequests, setEventRequests] = useState<Awaited<ReturnType<typeof getMyEventRequests>>>([])
  const [eventStats, setEventStats] = useState<EventStats>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [applicationsTab, setApplicationsTab] = useState<ApplicationsTab>('list')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [apps, requests] = await Promise.all([
        getMyApplications(),
        user?.role === 'organizer' ? getMyEventRequests() : Promise.resolve([]),
      ])
      setApplications(apps)
      setEventRequests(requests)

      const eventIds = [...new Set(apps.map((a) => a.eventId))]
      const stats: EventStats = {}
      await Promise.all(
        eventIds.map(async (eventId) => {
          const app = apps.find((a) => a.eventId === eventId)
          const list = await getApplicationsByEventId(eventId)
          const approvedCount = list.filter((a) => a.status === 'approved').length
          stats[eventId] = {
            maxVolunteers: app?.eventMaxVolunteers ?? 0,
            approvedCount,
          }
        })
      )
      setEventStats(stats)
    } catch {
      setError('Не удалось загрузить заявки. Проверьте подключение к серверу и повторите попытку.')
    } finally {
      setLoading(false)
    }
  }, [user?.role])

  useEffect(() => {
    void loadData()
  }, [loadData])

  if (loading) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Мои заявки</h1>
        <StateBlock title="Загружаем ваши заявки" description="Проверяем статусы участия и календарь мероприятий." loading />
      </main>
    )
  }

  const canCreateEvent = user?.role === 'organizer' || user?.role === 'admin'

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Мои заявки</h1>
        {canCreateEvent && (
          <Button variant="primary" size="sm" onClick={() => navigate(ROUTES.createEvent)}>
            Создать мероприятие
          </Button>
        )}
      </div>
      {user?.role === 'organizer' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Заявки на создание мероприятий</h2>
          {error ? (
            <StateBlock title="Не удалось загрузить заявки" description={error} tone="error" icon="CircleAlert" actionLabel="Повторить" onAction={() => void loadData()} />
          ) : (
            <EventRequestList requests={eventRequests} emptyMessage="У вас пока нет заявок на создание мероприятий" />
          )}
        </section>
      )}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Заявки на участие в мероприятиях</h2>
        <div className={styles.tabs}>
          <button
            type="button"
            className={applicationsTab === 'list' ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => setApplicationsTab('list')}
          >
            Список заявок
          </button>
          <button
            type="button"
            className={applicationsTab === 'calendar' ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => setApplicationsTab('calendar')}
          >
            Календарь
          </button>
        </div>
        {error ? (
          <StateBlock title="Не удалось загрузить заявки" description={error} tone="error" icon="CircleAlert" actionLabel="Повторить" onAction={() => void loadData()} />
        ) : applicationsTab === 'list' ? (
          <ApplicationList
            applications={applications}
            eventStats={eventStats}
            emptyMessage="У вас пока нет заявок на мероприятия"
          />
        ) : (
          <VolunteerCalendar applications={applications} />
        )}
      </section>
    </main>
  )
}
