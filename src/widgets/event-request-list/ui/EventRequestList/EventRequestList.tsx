import { Icon, StateBlock } from '@/shared/ui'
import { formatDate } from '@/shared/lib'
import type { EventRequest } from '@/entities/event-request'
import styles from './EventRequestList.module.scss'

const STATUS_LABEL: Record<EventRequest['status'], string> = {
  pending: 'На рассмотрении',
  approved: 'Одобрена',
  rejected: 'Отклонена',
}

const STATUS_ICON: Record<EventRequest['status'], 'Read' | 'CircleCheck' | 'CircleAlert'> = {
  pending: 'Read',
  approved: 'CircleCheck',
  rejected: 'CircleAlert',
}

export interface EventRequestListProps {
  requests: EventRequest[]
  emptyMessage?: string
}

export function EventRequestList({ requests, emptyMessage = 'Заявок на создание мероприятий нет' }: EventRequestListProps) {
  if (requests.length === 0) {
    return (
      <StateBlock
        title={emptyMessage}
        description="Созданные вами черновики и заявки на модерацию будут отображаться в этом блоке."
        icon="CircleQuestion"
      />
    )
  }

  return (
    <ul className={styles.list}>
      {requests.map((req) => (
        <li key={req.id} className={styles.item}>
          <div className={styles.header}>
            <strong>{req.payload.title}</strong>
            <span className={styles.status} data-status={req.status}>
              <Icon name={STATUS_ICON[req.status]} size={14} />
              {STATUS_LABEL[req.status]}
            </span>
          </div>
          <p className={styles.meta}>{formatDate(req.createdAt)}</p>
          {req.status === 'rejected' && req.rejectionReason && (
            <div className={styles.rejection}>
              <strong>Причина отклонения:</strong> {req.rejectionReason}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
