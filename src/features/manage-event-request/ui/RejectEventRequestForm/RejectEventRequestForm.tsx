import { useState, type FormEvent } from 'react'
import { Button } from '@/shared/ui'
import { required } from '@/shared/lib'
import styles from './RejectEventRequestForm.module.scss'

export interface RejectEventRequestFormProps {
  onConfirm: (reason: string) => void
  onCancel: () => void
  loading?: boolean
}

export function RejectEventRequestForm({ onConfirm, onCancel, loading }: RejectEventRequestFormProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const err = required(reason.trim(), 'Причина отклонения')
    if (err) {
      setError(err)
      return
    }
    onConfirm(reason.trim())
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="reject-title">
      <div className={styles.modal}>
        <h2 id="reject-title" className={styles.title}>
          Причина отклонения заявки
        </h2>
        <p className={styles.hint}>Укажите причину — она будет видна организатору.</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <textarea
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError(null) }}
            placeholder="Например: неполные данные о мероприятии..."
            rows={4}
            className={styles.textarea}
            disabled={loading}
            required
            aria-invalid={!!error}
          />
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.actions}>
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Отмена
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Отправка...' : 'Отклонить заявку'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
