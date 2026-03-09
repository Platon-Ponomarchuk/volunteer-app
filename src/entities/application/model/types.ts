export type ApplicationStatus = 'pending' | 'approved' | 'rejected'

export interface Application {
  id: string
  eventId: string
  userId: string
  status: ApplicationStatus
  roleId?: string
  roleName?: string
  message?: string
  createdAt: string
  updatedAt: string
  eventTitle?: string
  /** Дата мероприятия (для проверки пересечений и календаря) */
  eventDate?: string
  userName?: string
}
