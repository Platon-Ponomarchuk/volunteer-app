import { request } from '@/shared/api'
import { AUTH_USER_ID_KEY } from '@/shared/constants'
import type { EventRequest, EventRequestPayload } from '../model/types'

const BASE = '/eventRequests'

/** Заявка по ID */
export async function getEventRequestById(id: string): Promise<EventRequest> {
  return request<EventRequest>(`${BASE}/${id}`)
}

/** Все заявки на создание мероприятий (для админа) */
export async function getEventRequests(params?: { status?: string }): Promise<EventRequest[]> {
  const result = await request<EventRequest[]>(BASE, {
    params: params?.status ? { status: params.status } : undefined,
  })
  return Array.isArray(result) ? result : []
}

/** Заявки текущего организатора */
export async function getMyEventRequests(): Promise<EventRequest[]> {
  const userId = typeof window !== 'undefined' ? localStorage.getItem(AUTH_USER_ID_KEY) : null
  if (!userId) return []
  const result = await request<EventRequest[]>(BASE, { params: { organizerId: userId } })
  return Array.isArray(result) ? result : []
}

/** Создать заявку на создание мероприятия */
export async function createEventRequest(payload: EventRequestPayload): Promise<EventRequest> {
  const userId = typeof window !== 'undefined' ? localStorage.getItem(AUTH_USER_ID_KEY) : null
  if (!userId) throw new Error('Необходима авторизация')
  const now = new Date().toISOString()
  const body = {
    organizerId: userId,
    status: 'pending',
    payload,
    createdAt: now,
    updatedAt: now,
  }
  return request<EventRequest>(BASE, { method: 'POST', body: body as Record<string, unknown> })
}

/** Одобрить заявку (админ): обновить статус и привязать созданное мероприятие. Создание мероприятия вызывающая сторона выполняет сама. */
export async function approveEventRequest(id: string, eventId: string): Promise<EventRequest> {
  return request<EventRequest>(`${BASE}/${id}`, {
    method: 'PATCH',
    body: { status: 'approved', eventId, updatedAt: new Date().toISOString() } as Record<string, unknown>,
  })
}

/** Отклонить заявку (админ). Причина обязательна. */
export async function rejectEventRequest(id: string, rejectionReason: string): Promise<EventRequest> {
  return request<EventRequest>(`${BASE}/${id}`, {
    method: 'PATCH',
    body: { status: 'rejected', rejectionReason } as Record<string, unknown>,
  })
}
