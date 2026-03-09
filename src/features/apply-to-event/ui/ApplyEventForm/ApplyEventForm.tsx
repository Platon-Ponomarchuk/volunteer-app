import { useState, type FormEvent } from 'react'
import { clsx } from 'clsx'
import { Button, Input } from '@/shared/ui'
import { required } from '@/shared/lib'
import type { EventRole } from '@/entities/event'
import styles from './ApplyEventForm.module.scss'

export interface ApplyEventFormProps {
  roles: EventRole[]
  loading: boolean
  submitError?: string | null
  onSubmit: (data: { roleId: string; roleName?: string; message?: string }) => void
  onCancel: () => void
}

export function ApplyEventForm({ roles, loading, submitError, onSubmit, onCancel }: ApplyEventFormProps) {
  const [roleId, setRoleId] = useState('')
  const [message, setMessage] = useState('')
  const [roleError, setRoleError] = useState<string | null>(null)
  const roleRequired = roles.length > 0

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setRoleError(null)
    const roleValidation = roleRequired ? required(roleId, 'Выберите роль') : null
    if (roleValidation) {
      setRoleError(roleValidation)
      return
    }
    const selectedRole = roles.find((r) => r.id === roleId)
    onSubmit({
      roleId: roleId || '',
      roleName: selectedRole?.name,
      message: message.trim() || undefined,
    })
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="apply-title">
      <div className={styles.modal}>
        <h2 id="apply-title" className={styles.title}>
          Заявка на участие
        </h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          {roles.length > 0 && (
            <div className={styles.field}>
              <label htmlFor="apply-role">Роль *</label>
              <select
                id="apply-role"
                value={roleId}
                onChange={(e) => { setRoleId(e.target.value); setRoleError(null) }}
                className={clsx(styles.select, roleError && styles.selectError)}
                disabled={loading}
                required={roleRequired}
                aria-invalid={!!roleError}
                aria-describedby={roleError ? 'apply-role-error' : undefined}
              >
                <option value="">Выберите роль</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.requiredCount} чел.)
                  </option>
                ))}
              </select>
              {roleError && (
                <span id="apply-role-error" className={styles.error} role="alert">
                  {roleError}
                </span>
              )}
            </div>
          )}
          <Input
            label="Сообщение организатору (необязательно)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={loading}
            className={styles.input}
          />
          {submitError && <p className={styles.submitError} role="alert">{submitError}</p>}
          <div className={styles.actions}>
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Отмена
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Отправка...' : 'Отправить заявку'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
