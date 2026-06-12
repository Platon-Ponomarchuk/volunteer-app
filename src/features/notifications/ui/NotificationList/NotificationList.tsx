import { useState, useEffect } from 'react'
import { Button, Icon, StateBlock } from '@/shared/ui'
import { getNotificationsByUser, markNotificationAsRead, markAllAsRead } from '@/entities/notification'
import { formatDate } from '@/shared/lib'
import type { Notification } from '@/entities/notification'
import styles from './NotificationList.module.scss'

interface NotificationListProps {
  userId: string
}

export function NotificationList({ userId }: NotificationListProps) {
  const [list, setList] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    let cancelled = false
    const tid = setTimeout(() => { if (!cancelled) setLoading(true) }, 0)
    setError(null)
    getNotificationsByUser(userId)
      .then((data) => {
        if (!cancelled) setList(data)
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось загрузить уведомления.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      clearTimeout(tid)
    }
  }, [userId])

  const handleMarkRead = async (id: string) => {
    setUpdating(true)
    setError(null)
    try {
      await markNotificationAsRead(id)
      setList((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    } catch {
      setError('Не удалось отметить уведомление прочитанным.')
    } finally {
      setUpdating(false)
    }
  }

  const handleMarkAllRead = async () => {
    setUpdating(true)
    setError(null)
    try {
      await markAllAsRead(userId)
      const data = await getNotificationsByUser(userId)
      setList(data)
    } catch {
      setError('Не удалось обновить уведомления.')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return <StateBlock title="Загружаем уведомления" description="Проверяем последние изменения по вашим заявкам." loading />
  }

  if (error && list.length === 0) {
    return <StateBlock title="Не удалось загрузить уведомления" description={error} tone="error" icon="CircleAlert" />
  }

  if (list.length === 0) {
    return <StateBlock title="Нет уведомлений" description="Когда появятся обновления по заявкам, они будут здесь." icon="BellOn" />
  }

  const unreadCount = list.filter((n) => !n.read).length

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.title}>
          <Icon name="BellOn" size={22} />
          Уведомления
        </span>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead} disabled={updating}>
            {updating ? 'Обновление...' : 'Отметить все прочитанными'}
          </Button>
        )}
      </div>
      {error && <StateBlock title="Действие не выполнено" description={error} tone="error" icon="CircleAlert" className={styles.inlineState} />}
      <ul className={styles.list}>
        {list.map((n) => (
          <li
            key={n.id}
            className={n.read ? styles.itemRead : styles.item}
            role="button"
            tabIndex={0}
            onClick={() => !n.read && !updating && void handleMarkRead(n.id)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !n.read && !updating) void handleMarkRead(n.id)
            }}
          >
            <div className={styles.itemHeader}>
              <strong className={styles.itemTitle}>{n.title}</strong>
              <span className={styles.date}>{formatDate(n.createdAt)}</span>
            </div>
            <p className={styles.message}>{n.message}</p>
            {!n.read && (
              <Button variant="ghost" size="sm" className={styles.markRead} disabled={updating} onClick={(e) => { e.stopPropagation(); void handleMarkRead(n.id) }}>
                {updating ? '...' : 'Прочитано'}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
