/** Базовые типы для HTTP-клиента */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface RequestConfig extends Omit<RequestInit, 'method' | 'body'> {
  method?: HttpMethod
  body?: unknown
  params?: Record<string, string>
}

export interface ApiError {
  message: string
  status: number
  code?: string
}
