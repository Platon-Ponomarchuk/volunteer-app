import { EventCard } from '@/entities/event'
import type { Event } from '@/entities/event'
import { StateBlock } from '@/shared/ui'
import styles from './EventList.module.scss'

export interface EventListProps {
  events: Event[] | undefined
  loading?: boolean
  error?: string | null
  emptyMessage?: string
  onRetry?: () => void
  className?: string
}

export function EventList({
  events,
  loading,
  error,
  emptyMessage = 'Мероприятий не найдено',
  onRetry,
  className,
}: EventListProps) {
  if (loading) {
    return (
      <div className={styles.wrapper}>
        <StateBlock title="Загружаем мероприятия" description="Подбираем актуальные события по заданным фильтрам." loading />
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.wrapper}>
        <StateBlock
          title="Не удалось загрузить мероприятия"
          description={error}
          tone="error"
          icon="CircleAlert"
          actionLabel={onRetry ? 'Повторить' : undefined}
          onAction={onRetry}
        />
      </div>
    )
  }

  if (!events?.length) {
    return (
      <div className={styles.wrapper}>
        <StateBlock title={emptyMessage} description="Попробуйте изменить фильтры или вернуться позже." icon="Search" />
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
