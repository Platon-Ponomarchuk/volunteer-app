import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyApplications, getApplicationsByEventId } from '@/entities/application'
import { getMyEventRequests } from '@/entities/event-request'
import { getEvents } from '@/entities/event'
import { ApplicationList } from '@/widgets/application-list'
import { EventRequestList } from '@/widgets/event-request-list'
import { VolunteerCalendar } from '@/widgets/volunteer-calendar'
import { ApplicationActions } from '@/features/manage-application'
import { Button, StateBlock } from '@/shared/ui'
import { ROUTES } from '@/shared/constants'
import { useAuthStore } from '@/app/store'
import { formatDate } from '@/shared/lib'
import type { Application } from '@/entities/application'
import type { Event } from '@/entities/event'
import styles from './MyApplicationsPage.module.scss'

type EventStats = Record<string, { maxVolunteers: number; approvedCount: number }>
type ApplicationsTab = 'list' | 'calendar'
type OrganizerApplication = Application & {
  eventTitle?: string
  eventDate?: string
  eventStatus?: Event['status']
}

export function MyApplicationsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [applications, setApplications] = useState<Awaited<ReturnType<typeof getMyApplications>>>([])
  const [eventRequests, setEventRequests] = useState<Awaited<ReturnType<typeof getMyEventRequests>>>([])
  const [organizerApplications, setOrganizerApplications] = useState<OrganizerApplication[]>([])
  const [eventStats, setEventStats] = useState<EventStats>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [applicationsTab, setApplicationsTab] = useState<ApplicationsTab>('list')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [apps, requests, ownedEvents] = await Promise.all([
        getMyApplications(),
        user?.role === 'organizer' ? getMyEventRequests() : Promise.resolve([]),
        user?.role === 'organizer' || user?.role === 'admin'
          ? getEvents({ organizerId: user.id, sortBy: 'date', order: 'desc' })
          : Promise.resolve([]),
      ])
      setApplications(apps)
      setEventRequests(requests)

      const ownedApplications = await Promise.all(
        ownedEvents.map(async (event) => {
          const list = await getApplicationsByEventId(event.id)
          return list.map((app) => ({
            ...app,
            eventTitle: event.title,
            eventDate: event.date,
            eventStatus: event.status,
          }))
        })
      )
      setOrganizerApplications(ownedApplications.flat())

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
  }, [user?.id, user?.role])

  const reloadOrganizerApplications = useCallback(async () => {
    if (!user || (user.role !== 'organizer' && user.role !== 'admin')) return
    const ownedEvents = await getEvents({ organizerId: user.id, sortBy: 'date', order: 'desc' })
    const ownedApplications = await Promise.all(
      ownedEvents.map(async (event) => {
        const list = await getApplicationsByEventId(event.id)
        return list.map((app) => ({
          ...app,
          eventTitle: event.title,
          eventDate: event.date,
          eventStatus: event.status,
        }))
      })
    )
    setOrganizerApplications(ownedApplications.flat())
  }, [user])

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
      {user?.role === 'organizer_pending' && (
        <StateBlock
          title="Заявка на роль организатора ожидает одобрения"
          description="После одобрения администратором здесь появится возможность создавать мероприятия."
          icon="CircleQuestion"
          className={styles.section}
        />
      )}
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
      {canCreateEvent && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Заявки волонтёров на мои мероприятия</h2>
            {organizerApplications.length > 0 && (
              <span className={styles.counter}>{organizerApplications.length}</span>
            )}
          </div>
          {error ? (
            <StateBlock title="Не удалось загрузить заявки" description={error} tone="error" icon="CircleAlert" actionLabel="Повторить" onAction={() => void loadData()} />
          ) : organizerApplications.length === 0 ? (
            <StateBlock
              title="Заявок от волонтёров пока нет"
              description="Когда волонтёр отправит заявку на ваше мероприятие, она появится здесь."
              icon="CircleQuestion"
            />
          ) : (
            <ul className={styles.organizerList}>
              {organizerApplications.map((app) => (
                <li key={app.id} className={styles.organizerItem}>
                  <div className={styles.organizerItemMain}>
                    <div>
                      <h3 className={styles.eventTitle}>{app.eventTitle ?? `Мероприятие #${app.eventId}`}</h3>
                      <p className={styles.meta}>
                        {app.userName ?? `Пользователь #${app.userId}`}
                        {app.eventDate && ` · ${formatDate(app.eventDate)}`}
                        {app.roleName && ` · Роль: ${app.roleName}`}
                      </p>
                    </div>
                    <span className={styles.status} data-status={app.status}>
                      {app.status === 'pending' ? 'На рассмотрении' : app.status === 'approved' ? 'Подтверждена' : 'Отклонена'}
                    </span>
                  </div>
                  {app.message && <p className={styles.message}>{app.message}</p>}
                  <div className={styles.organizerActions}>
                    <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.manageEventById(app.eventId))}>
                      Открыть мероприятие
                    </Button>
                    <ApplicationActions application={app} onUpdated={reloadOrganizerApplications} />
                  </div>
                </li>
              ))}
            </ul>
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
