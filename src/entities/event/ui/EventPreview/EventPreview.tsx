import { Card } from '@/shared/ui'
import { formatDate, formatDateTime } from '@/shared/lib'
import type { Event } from '../../model/types'
import styles from './EventPreview.module.scss'

export interface EventPreviewProps {
  event: Event
  className?: string
}

export function EventPreview({ event, className }: EventPreviewProps) {
  return (
    <Card padding="lg" className={className}>
      {event.imageUrl && (
        <div className={styles.imageWrapper}>
          <img src={event.imageUrl} alt="" className={styles.image} />
        </div>
      )}
      <span className={styles.category}>{event.categoryName ?? 'Мероприятие'}</span>
      <h1 className={styles.title}>{event.title}</h1>
      <dl className={styles.meta}>
        <div className={styles.metaItem}>
          <dt>Дата</dt>
          <dd>{event.endDate ? `${formatDate(event.date)} — ${formatDate(event.endDate)}` : formatDateTime(event.date)}</dd>
        </div>
        <div className={styles.metaItem}>
          <dt>Место</dt>
          <dd>{event.location}</dd>
        </div>
        {event.city && (
          <div className={styles.metaItem}>
            <dt>Город</dt>
            <dd>{event.city}</dd>
          </div>
        )}
        {event.schedule && (
          <div className={styles.metaItem}>
            <dt>Расписание</dt>
            <dd>{event.schedule}</dd>
          </div>
        )}
        {event.organizerName && (
          <div className={styles.metaItem}>
            <dt>Организатор</dt>
            <dd>{event.organizerName}</dd>
          </div>
        )}
      </dl>
      <div className={styles.description}>
        <p>{event.description}</p>
      </div>
      {event.roles && event.roles.length > 0 && (
        <section className={styles.roles}>
          <h3>Роли для волонтёров</h3>
          <ul>
            {event.roles.map((role) => (
              <li key={role.id}>
                {role.name} — {role.requiredCount} чел.
                {role.description && ` (${role.description})`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Card>
  )
}
