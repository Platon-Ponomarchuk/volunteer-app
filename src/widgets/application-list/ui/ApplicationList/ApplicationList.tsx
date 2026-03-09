import { Link } from '@/shared/ui'
import { Icon } from '@/shared/ui'
import type { Application } from '@/entities/application'
import { ROUTES } from '@/shared/constants'
import { formatDate } from '@/shared/lib'
import styles from './ApplicationList.module.scss'

const STATUS_LABEL: Record<Application['status'], string> = {
  pending: 'На рассмотрении',
  approved: 'Подтверждена',
  rejected: 'Отклонена',
}

const STATUS_ICON: Record<Application['status'], 'Read' | 'CircleCheck' | 'CircleAlert'> = {
  pending: 'Read',
  approved: 'CircleCheck',
  rejected: 'CircleAlert',
}

export interface ApplicationListProps {
  applications: Application[]
  eventStats?: Record<string, { maxVolunteers: number; approvedCount: number }>
  emptyMessage?: string
  className?: string
}

export function ApplicationList({
  applications,
  eventStats = {},
  emptyMessage = 'Заявок нет',
  className,
}: ApplicationListProps) {
  if (!applications.length) {
    return <p className={styles.empty}>{emptyMessage}</p>
  }

  return (
    <ul className={`${styles.list} ${className ?? ''}`}>
      {applications.map((app) => {
        const stats = eventStats[app.eventId]
        return (
          <li key={app.id} className={styles.item}>
            <Link to={ROUTES.eventById(app.eventId)} className={styles.cardLink}>
              <div className={styles.main}>
                <span className={styles.eventTitle}>{app.eventTitle ?? `Мероприятие #${app.eventId}`}</span>
                <span className={styles.status} data-status={app.status}>
                  <Icon name={STATUS_ICON[app.status]} size={14} />
                  {STATUS_LABEL[app.status]}
                </span>
              </div>
              <div className={styles.statsRow}>
                {app.eventDate && (
                  <span className={styles.statItem}>Дата: {formatDate(app.eventDate)}</span>
                )}
                {stats && (stats.maxVolunteers > 0 || stats.approvedCount > 0) && (
                  <span className={styles.statItem}>
                    Волонтёры: {stats.approvedCount} / {stats.maxVolunteers}
                  </span>
                )}
                {app.roleName && <span className={styles.statItem}>Роль: {app.roleName}</span>}
              </div>
              <p className={styles.date}>Подана: {formatDate(app.createdAt)}</p>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
