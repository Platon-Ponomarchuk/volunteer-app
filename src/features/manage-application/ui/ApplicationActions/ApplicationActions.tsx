import { useState } from 'react'
import { Button } from '@/shared/ui'
import { approveApplication, rejectApplication } from '@/entities/application'
import type { Application } from '@/entities/application'
import styles from './ApplicationActions.module.scss'

export interface ApplicationActionsProps {
  application: Application
  onUpdated?: () => void
  onError?: (message: string) => void
}

export function ApplicationActions({ application, onUpdated, onError }: ApplicationActionsProps) {
  const [loading, setLoading] = useState(false)

  if (application.status !== 'pending') {
    return null
  }

  const handleApprove = async () => {
    setLoading(true)
    try {
      await approveApplication(application.id)
      onUpdated?.()
    } catch {
      onError?.('Не удалось подтвердить заявку')
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    setLoading(true)
    try {
      await rejectApplication(application.id)
      onUpdated?.()
    } catch {
      onError?.('Не удалось отклонить заявку')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.actions}>
      <Button size="sm" onClick={handleApprove} disabled={loading}>
        Подтвердить
      </Button>
      <Button size="sm" variant="outline" onClick={handleReject} disabled={loading}>
        Отклонить
      </Button>
    </div>
  )
}
