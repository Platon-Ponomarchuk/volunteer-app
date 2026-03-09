import { useState } from 'react'
import { Button, Link } from '@/shared/ui'
import { createApplication, getMyApplications } from '@/entities/application'
import { useAuthStore } from '@/app/store'
import type { Event, EventRole } from '@/entities/event'
import { ROUTES } from '@/shared/constants'
import { ApplyEventForm } from '../ApplyEventForm'
import styles from './ApplyToEventButton.module.scss'

const eventDateKey = (dateStr: string) => dateStr.slice(0, 10)

export interface ApplyToEventButtonProps {
  event: Event
  onSuccess?: () => void
  onError?: (message: string) => void
  className?: string
}

export function ApplyToEventButton({ event, onSuccess, onError, className }: ApplyToEventButtonProps) {
  const user = useAuthStore((s) => s.user)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  if (!user) {
    return (
      <p className={styles.hint}>
        <Link to={ROUTES.auth.login}>Войдите</Link>, чтобы записаться на мероприятие
      </p>
    )
  }

  const handleSubmit = async (data: { roleId: string; roleName?: string; message?: string }) => {
    setSubmitError(null)
    const targetDate = eventDateKey(event.date)
    const myApps = await getMyApplications()
    const hasSameDate = myApps.some(
      (app) => app.eventId !== event.id && app.eventDate && eventDateKey(app.eventDate) === targetDate
    )
    if (hasSameDate) {
      setSubmitError('Нельзя записаться на два мероприятия в одну дату. У вас уже есть заявка на этот день.')
      return
    }
    setLoading(true)
    try {
      await createApplication({
        eventId: event.id,
        roleId: data.roleId,
        roleName: data.roleName,
        message: data.message,
      })
      setOpen(false)
      onSuccess?.()
    } catch {
      setSubmitError('Не удалось отправить заявку')
      onError?.('Не удалось отправить заявку')
    } finally {
      setLoading(false)
    }
  }

  const roles: EventRole[] = event.roles ?? []

  return (
    <div className={className}>
      <Button onClick={() => setOpen(true)}>Записаться на мероприятие</Button>
      {open && (
        <ApplyEventForm
          roles={roles}
          loading={loading}
          submitError={submitError}
          onSubmit={handleSubmit}
          onCancel={() => { setOpen(false); setSubmitError(null) }}
        />
      )}
    </div>
  )
}
