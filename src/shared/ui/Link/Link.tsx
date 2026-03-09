import { type AnchorHTMLAttributes, type ReactNode } from 'react'
import { Link as RouterLink, type To } from 'react-router-dom'
import { clsx } from 'clsx'
import styles from './Link.module.scss'

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: To
  children: ReactNode
  variant?: 'default' | 'primary' | 'muted'
  className?: string
}

export function Link({ to, children, variant = 'default', className, ...rest }: LinkProps) {
  return (
    <RouterLink to={to} className={clsx(styles.link, styles[variant], className)} {...rest}>
      {children}
    </RouterLink>
  )
}
