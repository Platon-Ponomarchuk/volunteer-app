import { useState, type FormEvent } from 'react'
import { Button, Input } from '@/shared/ui'
import { updateUser, type User } from '@/entities/user'
import { useAuthStore } from '@/app/store'
import styles from './ProfileForm.module.scss'

export interface ProfileFormProps {
  user: User
  onSuccess?: () => void
  onError?: (message: string) => void
  onCancel?: () => void
}

export function ProfileForm({ user, onSuccess, onError, onCancel }: ProfileFormProps) {
  const setUser = useAuthStore((s) => s.setUser)
  const [name, setName] = useState(user.name)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [loading, setLoading] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setNameError(null)
    setLoading(true)
    try {
      const updated = await updateUser(user.id, { name, phone: phone || undefined })
      setUser(updated)
      onSuccess?.()
    } catch {
      const msg = 'Не удалось сохранить изменения'
      setNameError(msg)
      onError?.(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <Input
        type="email"
        label="Email"
        value={user.email}
        disabled
        fullWidth
      />
      <Input
        type="text"
        label="Имя"
        value={name}
        onChange={(e) => { setName(e.target.value); setNameError(null) }}
        error={nameError ?? undefined}
        required
        fullWidth
        disabled={loading}
      />
      <Input
        type="tel"
        label="Телефон"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        fullWidth
        disabled={loading}
      />
      <p className={styles.role}>Роль: {user.role === 'volunteer' ? 'Волонтёр' : user.role === 'organizer' ? 'Организатор' : 'Администратор'}</p>
      <div className={styles.actions}>
        <Button type="submit" disabled={loading}>
          {loading ? 'Сохранение...' : 'Сохранить'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
            Отмена
          </Button>
        )}
      </div>
    </form>
  )
}
