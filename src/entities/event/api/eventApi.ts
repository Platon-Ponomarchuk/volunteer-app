import { request } from '@/shared/api'
import type { Event } from '../model/types'

const BASE = '/events'

export interface GetEventsParams {
  categoryId?: string
  dateFrom?: string
  dateTo?: string
  city?: string
  search?: string
  status?: string
  limit?: number
  offset?: number
  /** Поле сортировки */
  sortBy?: string
  /** Порядок сортировки */
  order?: 'asc' | 'desc'
}

/** Список мероприятий */
export async function getEvents(params?: GetEventsParams): Promise<Event[]> {
  const searchParams: Record<string, string> = {}
  if (params?.categoryId) searchParams.categoryId = params.categoryId
  if (params?.dateFrom) searchParams.date_gte = params.dateFrom
  if (params?.dateTo) searchParams.date_lte = params.dateTo
  if (params?.city) searchParams.city = params.city
  if (params?.search) searchParams.q = params.search
  if (params?.status) searchParams.status = params.status
  if (params?.limit !== undefined) searchParams._limit = String(params.limit)
  if (params?.offset !== undefined) searchParams._start = String(params.offset)
  if (params?.sortBy) searchParams._sort = params.sortBy
  if (params?.order) searchParams._order = params.order

  const result = await request<Event[]>(BASE, {
    params: Object.keys(searchParams).length > 0 ? searchParams : undefined,
  })
  return Array.isArray(result) ? result : []
}

/** Ближайшие опубликованные мероприятия (для главной, только будущие) */
export async function getUpcomingEvents(limit = 6): Promise<Event[]> {
  const now = new Date().toISOString()
  return getEvents({
    status: 'published',
    dateFrom: now,
    limit,
    sortBy: 'date',
    order: 'asc',
  })
}

/** Популярные/последние мероприятия (для главной, без фильтра по дате) */
export async function getPopularEvents(limit = 6): Promise<Event[]> {
  return getEvents({
    status: 'published',
    limit,
    sortBy: 'date',
    order: 'desc',
  })
}

/** Мероприятие по ID */
export async function getEventById(id: string): Promise<Event> {
  return request<Event>(`${BASE}/${id}`)
}

export interface CreateEventData {
  title: string
  description: string
  date: string
  endDate?: string
  location: string
  city?: string
  schedule?: string
  categoryId: string
  status?: Event['status']
  organizerId: string
  maxVolunteers?: number
  roles?: Event['roles']
  imageUrl?: string
}

/** Создать мероприятие */
export async function createEvent(data: CreateEventData): Promise<Event> {
  return request<Event>(BASE, { method: 'POST', body: data as unknown as Record<string, unknown> })
}

/** Обновить мероприятие */
export async function updateEvent(id: string, data: Partial<CreateEventData>): Promise<Event> {
  return request<Event>(`${BASE}/${id}`, { method: 'PATCH', body: data as unknown as Record<string, unknown> })
}
