/** Заявка организатора на создание мероприятия (одобряет администратор) */

export type EventRequestStatus = 'pending' | 'approved' | 'rejected'

export interface EventRequestPayload {
  title: string
  description: string
  date: string
  endDate?: string
  location: string
  city?: string
  schedule?: string
  categoryId: string
  maxVolunteers?: number
  roles?: { id: string; name: string; requiredCount: number; description?: string }[]
}

export interface EventRequest {
  id: string
  organizerId: string
  organizerName?: string
  status: EventRequestStatus
  /** Причина отклонения (заполняет администратор), видна организатору */
  rejectionReason?: string
  payload: EventRequestPayload
  createdAt: string
  updatedAt: string
  /** ID созданного мероприятия после одобрения */
  eventId?: string
}
