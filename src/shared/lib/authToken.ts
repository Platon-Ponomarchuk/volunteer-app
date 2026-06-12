import { AUTH_TOKEN_KEY } from '@/shared/constants'

interface AuthTokenPayload {
  id?: string
  sub?: string
  role?: string
  exp?: number
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  return atob(padded)
}

export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setStoredAuthToken(token: string): void {
  if (typeof window === 'undefined') return
  // [ВКР] Упрощённая аутентификация для MVP.
  // TODO: Миграция на httpOnly cookies + refresh-токены для продакшена.
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearStoredAuthToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(AUTH_TOKEN_KEY)
}

export function getCurrentUserIdFromToken(): string | null {
  const token = getStoredAuthToken()
  if (!token) return null
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const parsed = JSON.parse(decodeBase64Url(payload)) as AuthTokenPayload
    return parsed.id ?? parsed.sub ?? null
  } catch {
    return null
  }
}
