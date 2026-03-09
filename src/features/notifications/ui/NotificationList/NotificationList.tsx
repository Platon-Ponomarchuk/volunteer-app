import { useState, useEffect } from 'react'
import { Button, Icon } from '@/shared/ui'
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

  useEffect(() => {
    let cancelled = false
    const tid = setTimeout(() => { if (!cancelled) setLoading(true) }, 0)
    getNotificationsByUser(userId).then((data) => {
      if (!cancelled) setList(data)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
      clearTimeout(tid)
    }
  }, [userId])

  const handleMarkRead = async (id: string) => {
    await markNotificationAsRead(id)
    setList((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  const handleMarkAllRead = async () => {
    await markAllAsRead(userId)
    setLoading(true)
    getNotificationsByUser(userId)
      .then((data) => setList(data))
      .finally(() => setLoading(false))
  }

  if (loading) {
    return <p className={styles.loading}>Загрузка уведомлений...</p>
  }

  if (list.length === 0) {
    return <p className={styles.empty}>Нет уведомлений</p>
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
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
            Отметить все прочитанными
          </Button>
        )}
      </div>
      <ul className={styles.list}>
        {list.map((n) => (
          <li
            key={n.id}
            className={n.read ? styles.itemRead : styles.item}
            role="button"
            tabIndex={0}
            onClick={() => !n.read && void handleMarkRead(n.id)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !n.read) void handleMarkRead(n.id)
            }}
          >
            <div className={styles.itemHeader}>
              <strong className={styles.itemTitle}>{n.title}</strong>
              <span className={styles.date}>{formatDate(n.createdAt)}</span>
            </div>
            <p className={styles.message}>{n.message}</p>
            {!n.read && (
              <Button variant="ghost" size="sm" className={styles.markRead} onClick={(e) => { e.stopPropagation(); void handleMarkRead(n.id) }}>
                Прочитано
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
