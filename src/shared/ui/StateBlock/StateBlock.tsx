import { type ReactNode } from 'react'
import { clsx } from 'clsx'
import { Button } from '../Button'
import { Icon } from '../Icon'
import { Spinner } from '../Spinner'
import styles from './StateBlock.module.scss'

export interface StateBlockProps {
  title: string
  description?: string
  tone?: 'neutral' | 'error' | 'success'
  icon?: 'CircleQuestion' | 'CircleAlert' | 'CircleCheck' | 'Search' | 'BellOn'
  loading?: boolean
  actionLabel?: string
  onAction?: () => void
  children?: ReactNode
  className?: string
}

export function StateBlock({
  title,
  description,
  tone = 'neutral',
  icon = 'CircleQuestion',
  loading,
  actionLabel,
  onAction,
  children,
  className,
}: StateBlockProps) {
  return (
    <div className={clsx(styles.block, styles[tone], className)} role={tone === 'error' ? 'alert' : 'status'}>
      <div className={styles.iconWrap} aria-hidden>
        {loading ? <Spinner size="sm" /> : <Icon name={icon} size={24} />}
      </div>
      <div className={styles.content}>
        <p className={styles.title}>{title}</p>
        {description && <p className={styles.description}>{description}</p>}
        {children}
        {actionLabel && onAction && (
          <Button type="button" variant="outline" size="sm" onClick={onAction} className={styles.action}>
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
