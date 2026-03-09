import { clsx } from 'clsx'
import { Link } from '@/shared/ui'
import { Card } from '@/shared/ui'
import { formatDate } from '@/shared/lib'
import { ROUTES } from '@/shared/constants'
import type { Event } from '../../model/types'
import styles from './EventCard.module.scss'

export interface EventCardProps {
  event: Event
  className?: string
}

export function EventCard({ event, className }: EventCardProps) {
  return (
    <Link to={ROUTES.eventById(event.id)} className={clsx(styles.cardLink, className)}>
      <Card padding="md" className={styles.card}>
        <div className={styles.imageWrapper}>
          {event.imageUrl ? (
            <img src={event.imageUrl} alt="" className={styles.image} />
          ) : (
            <div className={styles.imagePlaceholder} aria-hidden />
          )}
        </div>
        <div className={styles.content}>
          <span className={styles.category}>{event.categoryName ?? 'Мероприятие'}</span>
          <h3 className={styles.title}>{event.title}</h3>
          <p className={styles.date}>{formatDate(event.date)}</p>
          <p className={styles.location}>{event.location}</p>
        </div>
      </Card>
    </Link>
  )
}
