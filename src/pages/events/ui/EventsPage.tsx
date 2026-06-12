import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getEvents } from '@/entities/event'
import { getCategories } from '@/entities/category'
import { EventFilters, type EventFiltersState } from '@/features/filters'
import { EventList } from '@/widgets/event-list'
import { Button } from '@/shared/ui'
import { ROUTES } from '@/shared/constants'
import { useAuthStore } from '@/app/store'
import type { Category } from '@/entities/category'
import styles from './EventsPage.module.scss'

const defaultFilters: EventFiltersState = {
  search: undefined,
  categoryId: undefined,
  city: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  status: 'published',
}

export function EventsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [filters, setFilters] = useState<EventFiltersState>(defaultFilters)
  const [events, setEvents] = useState<Awaited<ReturnType<typeof getEvents>> | undefined>(undefined)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoriesLoading, setCategoriesLoading] = useState(true)

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .finally(() => setCategoriesLoading(false))
  }, [])

  const loadEvents = useCallback((activeFilters: EventFiltersState, cancelledRef?: { current: boolean }) => {
    setLoading(true)
    setError(null)
    getEvents({
      ...activeFilters,
      status: 'published',
    })
      .then((data) => {
        if (!cancelledRef?.current) setEvents(data)
      })
      .catch(() => {
        if (!cancelledRef?.current) setError('Проверьте подключение к серверу и повторите попытку.')
      })
      .finally(() => {
        if (!cancelledRef?.current) setLoading(false)
      })
  }, [])

  useEffect(() => {
    const cancelledRef = { current: false }
    queueMicrotask(() => loadEvents(filters, cancelledRef))
    return () => { cancelledRef.current = true }
  }, [filters, loadEvents])

  const canCreateEvent = user?.role === 'organizer' || user?.role === 'admin'

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Каталог мероприятий</h1>
        {canCreateEvent && (
          <Button variant="primary" size="sm" onClick={() => navigate(ROUTES.createEvent)}>
            Создать мероприятие
          </Button>
        )}
      </div>
      {!categoriesLoading && (
        <EventFilters
          filters={filters}
          categories={categories}
          onChange={setFilters}
          className={styles.filters}
        />
      )}
      <EventList
        events={events}
        loading={loading}
        error={error}
        onRetry={() => loadEvents(filters)}
        className={styles.list}
      />
    </main>
  )
}
