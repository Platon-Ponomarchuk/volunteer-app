import { env } from '@/shared/config'
import { clearStoredAuthToken, getStoredAuthToken } from '@/shared/lib'
import type { ApiError, RequestConfig } from './types'

const DEFAULT_GET_CACHE_TIME = 30_000

interface CacheEntry {
  expiresAt: number
  value: unknown
}

const responseCache = new Map<string, CacheEntry>()
const inFlightRequests = new Map<string, Promise<unknown>>()

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

function getCacheKey(url: string, token: string | null): string {
  return `${token ?? 'anonymous'}:${url}`
}

export function clearRequestCache(): void {
  responseCache.clear()
  inFlightRequests.clear()
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) {
      clearStoredAuthToken()
    }
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
  const { method = 'GET', body, params, headers: customHeaders, cacheTime, ...rest } = config

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (customHeaders) {
    new Headers(customHeaders).forEach((value, key) => {
      headers[key] = value
    })
  }
  const token = getStoredAuthToken()
  if (token && !('Authorization' in headers)) {
    headers.Authorization = `Bearer ${token}`
  }

  const options: RequestInit = {
    method,
    headers,
    credentials: 'include',
    ...rest,
  }

  if (body !== undefined && method !== 'GET') {
    options.body = JSON.stringify(body)
  }

  const url = buildUrl(path, params)
  const isGet = method === 'GET'
  const ttl = cacheTime ?? DEFAULT_GET_CACHE_TIME
  const cacheKey = isGet && ttl > 0 ? getCacheKey(url, token) : null

  if (cacheKey) {
    const cached = responseCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T
    }

    const pending = inFlightRequests.get(cacheKey)
    if (pending) {
      return pending as Promise<T>
    }
  } else if (!isGet) {
    clearRequestCache()
  }

  const promise = fetch(url, options).then((response) => handleResponse<T>(response))

  if (!cacheKey) {
    return promise
  }

  inFlightRequests.set(cacheKey, promise)
  try {
    const data = await promise
    responseCache.set(cacheKey, {
      expiresAt: Date.now() + ttl,
      value: data,
    })
    return data
  } finally {
    inFlightRequests.delete(cacheKey)
  }
}
