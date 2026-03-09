import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Icon } from '@/shared/ui'
import { useAuthStore } from '@/app/store'
import { ProfileForm } from '@/features/auth'
import { ROUTES } from '@/shared/constants'
import styles from './ProfilePage.module.scss'

export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)

  if (!user) {
    return null
  }

  const handleLogout = () => {
    logout()
    navigate(ROUTES.main)
  }

  const roleLabel =
    user.role === 'volunteer' ? 'Волонтёр' : user.role === 'organizer' ? 'Организатор' : 'Администратор'

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>
        <Icon name="User" size={28} />
        Профиль
      </h1>

      <Card padding="lg" className={styles.card}>
        {!isEditing ? (
          <div className={styles.profileView}>
            <div className={styles.profileRow}>
              <span className={styles.profileLabel}>Email</span>
              <span className={styles.profileValue}>{user.email}</span>
            </div>
            <div className={styles.profileRow}>
              <span className={styles.profileLabel}>Имя</span>
              <span className={styles.profileValue}>{user.name}</span>
            </div>
            <div className={styles.profileRow}>
              <span className={styles.profileLabel}>Телефон</span>
              <span className={styles.profileValue}>{user.phone ?? '—'}</span>
            </div>
            <div className={styles.profileRow}>
              <span className={styles.profileLabel}>Роль</span>
              <span className={styles.profileValue}>{roleLabel}</span>
            </div>
            <div className={styles.editBtnWrap}>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                Редактировать
              </Button>
            </div>
          </div>
        ) : (
          <ProfileForm
            user={user}
            onSuccess={() => setIsEditing(false)}
            onCancel={() => setIsEditing(false)}
          />
        )}
      </Card>

      <div className={styles.logout}>
        <Button variant="outline" onClick={handleLogout}>
          <Icon name="Logout" size={20} />
          Выйти из аккаунта
        </Button>
      </div>
    </main>
  )
}
