import { clsx } from 'clsx'
import styles from './Spinner.module.scss'

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span
      className={clsx(styles.spinner, styles[size], className)}
      role="status"
      aria-label="Загрузка"
    />
  )
}
