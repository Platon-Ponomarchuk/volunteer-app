import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyApplications, getApplicationsByEventId } from '@/entities/application'
import { getMyEventRequests } from '@/entities/event-request'
import { ApplicationList } from '@/widgets/application-list'
import { EventRequestList } from '@/widgets/event-request-list'
import { VolunteerCalendar } from '@/widgets/volunteer-calendar'
import { Button } from '@/shared/ui'
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
  const [applicationsTab, setApplicationsTab] = useState<ApplicationsTab>('list')

  useEffect(() => {
    const load = async () => {
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
    }
    load().finally(() => setLoading(false))
  }, [user?.role])

  if (loading) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Мои заявки</h1>
        <p>Загрузка...</p>
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
          <EventRequestList requests={eventRequests} emptyMessage="У вас пока нет заявок на создание мероприятий" />
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
        {applicationsTab === 'list' ? (
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
