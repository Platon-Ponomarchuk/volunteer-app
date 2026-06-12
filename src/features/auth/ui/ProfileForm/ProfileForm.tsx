import { useState, type FormEvent } from 'react'
import { Button, FileUpload, Input } from '@/shared/ui'
import { updateUser, uploadAvatar, type User } from '@/entities/user'
import { useAuthStore } from '@/app/store'
import { fileToDataUrl } from '@/shared/lib'
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
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setNameError(null)
    setLoading(true)
    try {
      const updated = await updateUser(user.id, { name, phone: phone || undefined })
      if (avatarFile) {
        const image = await fileToDataUrl(avatarFile)
        const { url } = await uploadAvatar(image)
        setUser({ ...updated, avatar: url })
      } else {
        setUser(updated)
      }
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
      <FileUpload
        id="profile-avatar"
        label="Аватар"
        file={avatarFile}
        onChange={setAvatarFile}
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
