import { EventCard } from '@/entities/event'
import type { Event } from '@/entities/event'
import { Spinner } from '@/shared/ui'
import styles from './EventList.module.scss'

export interface EventListProps {
  events: Event[] | undefined
  loading?: boolean
  emptyMessage?: string
  className?: string
}

export function EventList({ events, loading, emptyMessage = 'Мероприятий не найдено', className }: EventListProps) {
  if (loading) {
    return (
      <div className={styles.wrapper}>
        <Spinner />
      </div>
    )
  }

  if (!events?.length) {
    return (
      <div className={styles.wrapper}>
        <p className={styles.empty}>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <ul className={`${styles.list} ${className ?? ''}`}>
      {events.map((event) => (
        <li key={event.id}>
          <EventCard event={event} />
        </li>
      ))}
    </ul>
  )
}
