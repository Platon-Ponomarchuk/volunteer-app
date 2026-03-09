import { type HTMLAttributes, type ReactNode } from 'react'
import { clsx } from 'clsx'
import styles from './Card.module.scss'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg'
  className?: string
}

export function Card({ children, padding = 'md', className, ...rest }: CardProps) {
  return (
    <div className={clsx(styles.card, styles[`padding-${padding}`], className)} {...rest}>
      {children}
    </div>
  )
}
