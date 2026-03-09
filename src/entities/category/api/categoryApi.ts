import { request } from '@/shared/api'
import type { Category } from '../model/types'

const BASE = '/categories'

/** Список категорий с сервера */
export async function getCategories(): Promise<Category[]> {
  const result = await request<Category[]>(BASE)
  return Array.isArray(result) ? result : []
}
