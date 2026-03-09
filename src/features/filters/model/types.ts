import type { GetEventsParams } from '@/entities/event'

export interface EventFiltersState extends GetEventsParams {
  categoryId?: string
  dateFrom?: string
  dateTo?: string
  city?: string
  search?: string
}
