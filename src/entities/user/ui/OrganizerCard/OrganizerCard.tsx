import { Card } from '@/shared/ui'
import { Icon } from '@/shared/ui'
import type { User } from '../../model/types'
import styles from './OrganizerCard.module.scss'

export interface OrganizerCardProps {
  organizer: User
  className?: string
}

export function OrganizerCard({ organizer, className }: OrganizerCardProps) {
  return (
    <Card padding="md" className={`${styles.card} ${className ?? ''}`}>
      <div className={styles.avatarWrap}>
        {organizer.avatar ? (
          <img src={organizer.avatar} alt="" className={styles.avatarImg} />
        ) : (
          <span className={styles.avatarIcon} aria-hidden>
            <Icon name="User" size={32} />
          </span>
        )}
      </div>
      <h3 className={styles.name}>{organizer.name}</h3>
      <p className={styles.role}>Организатор</p>
    </Card>
  )
}
