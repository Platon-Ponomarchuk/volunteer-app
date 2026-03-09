import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { clsx } from 'clsx'
import styles from './Input.module.scss'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  fullWidth?: boolean
  leftAddon?: ReactNode
  rightAddon?: ReactNode
}

export function Input({
  label,
  error,
  size = 'md',
  className,
  fullWidth,
  leftAddon,
  rightAddon,
  id,
  ...rest
}: InputProps) {
  const generatedId = useId()
  const inputId = id ?? `input-${generatedId}`

  return (
    <div className={clsx(styles.wrapper, fullWidth ? styles.fullWidth : '', className)}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      <div className={styles.inputWrapper}>
        {leftAddon && <span className={styles.addon}>{leftAddon}</span>}
        <input
          id={inputId}
          className={clsx(
            styles.input,
            styles[size],
            error ? styles.hasError : '',
            leftAddon ? styles.hasLeftAddon : '',
            rightAddon ? styles.hasRightAddon : ''
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...rest}
        />
        {rightAddon && <span className={styles.addon}>{rightAddon}</span>}
      </div>
      {error && (
        <span id={`${inputId}-error`} className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
