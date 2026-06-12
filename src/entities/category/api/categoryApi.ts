import { request } from '@/shared/api'
import type { Category } from '../model/types'

const BASE = '/categories'

/** Список категорий с сервера */
export async function getCategories(): Promise<Category[]> {
  const result = await request<Category[]>(BASE, { cacheTime: 5 * 60 * 1000 })
  return Array.isArray(result) ? result : []
}
