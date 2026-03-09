import { env } from '@/shared/config'
import type { ApiError, RequestConfig } from './types'

function buildUrl(path: string, params?: Record<string, string>): string {
  const base = env.apiBaseUrl.replace(/\/$/, '')
  if (!base) {
    throw new Error(
      'VITE_API_BASE_URL не задан. Скопируйте .env.example в .env и укажите URL бэкенда (например http://89.169.144.126:3000).'
    )
  }
  const url = path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
  if (!params || Object.keys(params).length === 0) return url
  const search = new URLSearchParams(params).toString()
  return `${url}?${search}`
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error: ApiError = {
      message: response.statusText,
      status: response.status,
    }
    try {
      const data = await response.json() as { message?: string; code?: string }
      if (data.message) error.message = data.message
      if (data.code) error.code = data.code
    } catch {
      // body не JSON — оставляем statusText
    }
    throw error
  }

  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    return response.json() as Promise<T>
  }
  return undefined as T
}

export async function request<T>(path: string, config: RequestConfig = {}): Promise<T> {
  const { method = 'GET', body, params, headers: customHeaders, ...rest } = config

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...customHeaders,
  }

  const options: RequestInit = {
    method,
    headers,
    ...rest,
  }

  if (body !== undefined && method !== 'GET') {
    options.body = JSON.stringify(body)
  }

  const url = buildUrl(path, params)
  const response = await fetch(url, options)
  return handleResponse<T>(response)
}
