export type EventStatus = 'draft' | 'published' | 'cancelled'

export interface EventRole {
  id: string
  name: string
  requiredCount: number
  description?: string
}

export interface Event {
  id: string
  title: string
  description: string
  date: string
  endDate?: string
  location: string
  city?: string
  /** Расписание мероприятия (время, этапы и т.п.) */
  schedule?: string
  categoryId: string
  categoryName?: string
  status: EventStatus
  organizerId: string
  organizerName?: string
  maxVolunteers?: number
  roles?: EventRole[]
  imageUrl?: string
  createdAt: string
  updatedAt: string
}

export type EventListItem = Event
