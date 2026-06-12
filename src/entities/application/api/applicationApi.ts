import { request } from '@/shared/api'
import { getCurrentUserIdFromToken } from '@/shared/lib'
import type { Application } from '../model/types'

const BASE = '/applications'

/** Все заявки (для админки/аналитики) */
export async function getAllApplications(): Promise<Application[]> {
  const result = await request<Application[]>(BASE, { cacheTime: 10_000 })
  return Array.isArray(result) ? result : []
}

/** Заявки по мероприятию (сервер подставляет user по _expand=user) */
export async function getApplicationsByEventId(eventId: string): Promise<Application[]> {
  const result = await request<(Application & { user?: { name: string } })[]>(`${BASE}`, {
    params: { eventId, _expand: 'user' },
    cacheTime: 10_000,
  })
  const list = Array.isArray(result) ? result : []
  return list.map((item) => {
    const { user, ...app } = item
    return { ...app, userName: user?.name }
  })
}

const APPLICATIONS_LIMIT = 30

/** Заявки текущего пользователя (сервер подставляет event по _expand=event), лимит 30 */
export async function getMyApplications(): Promise<(Application & { eventMaxVolunteers?: number })[]> {
  const userId = getCurrentUserIdFromToken()
  if (!userId) return []
  const result = await request<(Application & { event?: { title: string; date: string; maxVolunteers?: number } })[]>(
    `${BASE}`,
    { params: { userId, _expand: 'event', _limit: String(APPLICATIONS_LIMIT) }, cacheTime: 10_000 }
  )
  const list = Array.isArray(result) ? result : []
  return list.map((item) => {
    const { event, ...app } = item
    return { ...app, eventTitle: event?.title, eventDate: event?.date, eventMaxVolunteers: event?.maxVolunteers }
  })
}

/** Создать заявку на мероприятие */
export async function createApplication(data: {
  eventId: string
  roleId?: string
  roleName?: string
  message?: string
}): Promise<Application> {
  const userId = getCurrentUserIdFromToken()
  if (!userId) throw new Error('Необходима авторизация')
  const now = new Date().toISOString()
  const body = {
    eventId: data.eventId,
    userId,
    roleId: data.roleId,
    roleName: data.roleName,
    message: data.message ?? '',
    status: 'pending' as const,
    createdAt: now,
    updatedAt: now,
  }
  return request<Application>(BASE, { method: 'POST', body })
}

/** Подтвердить заявку */
export async function approveApplication(id: string): Promise<Application> {
  return request<Application>(`${BASE}/${id}`, { method: 'PATCH', body: { status: 'approved' } })
}

/** Отклонить заявку */
export async function rejectApplication(id: string): Promise<Application> {
  return request<Application>(`${BASE}/${id}`, { method: 'PATCH', body: { status: 'rejected' } })
}

/** Отменить заявку */
export async function cancelApplication(id: string): Promise<void> {
  return request<void>(`${BASE}/${id}`, { method: 'DELETE' })
}
