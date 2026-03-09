import { request } from '@/shared/api'
import type { Notification } from '../model/types'

const BASE = '/notifications'

/** Список уведомлений пользователя */
export async function getNotificationsByUser(userId: string): Promise<Notification[]> {
  const result = await request<Notification[]>(BASE, {
    params: { userId, _sort: 'createdAt', _order: 'desc' },
  })
  return Array.isArray(result) ? result : []
}

/** Отметить уведомление как прочитанное */
export async function markNotificationAsRead(id: string): Promise<Notification> {
  return request<Notification>(`${BASE}/${id}`, {
    method: 'PATCH',
    body: { read: true } as unknown as Record<string, unknown>,
  })
}

/** Отметить все уведомления пользователя как прочитанные */
export async function markAllAsRead(userId: string): Promise<void> {
  const list = await getNotificationsByUser(userId)
  const unread = list.filter((n) => !n.read)
  await Promise.all(unread.map((n) => markNotificationAsRead(n.id)))
}
