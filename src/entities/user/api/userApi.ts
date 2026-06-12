import { request } from '@/shared/api'
import { clearStoredAuthToken, getStoredAuthToken, setStoredAuthToken } from '@/shared/lib'
import type { User } from '../model/types'

const BASE = '/users'

export interface AuthResponse {
  status: 'OK' | 'FAIL'
  error: string | null
  message: string | null
  user?: User
  token?: string
}

/** Текущий авторизованный пользователь (по JWT) */
export async function getCurrentUser(): Promise<User | null> {
  if (typeof window === 'undefined') return null
  if (!getStoredAuthToken()) return null
  try {
    return await request<User>('/auth/me')
  } catch {
    return null
  }
}

/** Пользователь по ID */
export async function getUserById(id: string): Promise<User> {
  return request<User>(`${BASE}/${id}`)
}

/** Список пользователей (для админки, отображение имён) */
export async function getUsers(): Promise<User[]> {
  const result = await request<User[]>(BASE)
  return Array.isArray(result) ? result : []
}

/** Список организаторов (для главной, популярные) */
export async function getOrganizers(limit = 6): Promise<User[]> {
  const result = await request<User[]>(BASE, {
    params: { role: 'organizer', _limit: String(limit) },
  })
  return Array.isArray(result) ? result : []
}

export interface LoginCredentials {
  email: string
  password: string
}

/** Вход: проверка пароля через POST /auth */
export async function login(credentials: LoginCredentials): Promise<User> {
  const res = await request<AuthResponse>('/auth', {
    method: 'POST',
    body: credentials as unknown as Record<string, unknown>,
  })
  if (res.status === 'FAIL') {
    throw new Error(res.message || res.error || 'Ошибка входа')
  }
  if (!res.user) {
    throw new Error('Ошибка входа')
  }
  if (res.token) {
    setStoredAuthToken(res.token)
  }
  return res.user
}

export interface RegisterData {
  email: string
  password: string
  name: string
  role?: User['role']
}

/** Регистрация: создание пользователя через POST /auth/register */
export async function register(data: RegisterData): Promise<User> {
  const res = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: {
      ...data,
      role: data.role ?? 'volunteer',
    } as Record<string, unknown>,
  })
  if (res.status === 'FAIL') {
    throw new Error(res.message || res.error || 'Ошибка регистрации')
  }
  if (!res.user) {
    throw new Error('Ошибка регистрации')
  }
  if (res.token) {
    setStoredAuthToken(res.token)
  }
  return res.user
}

/** Выход: очистка JWT из localStorage */
export function logout(): void {
  clearStoredAuthToken()
}

export interface UpdateUserData {
  name?: string
  phone?: string
  avatar?: string
}

/** Обновить профиль пользователя */
export async function updateUser(id: string, data: UpdateUserData): Promise<User> {
  return request<User>(`${BASE}/${id}`, { method: 'PATCH', body: data as Record<string, unknown> })
}

/** Загрузить аватар текущего пользователя */
export async function uploadAvatar(image: string): Promise<{ url: string }> {
  return request<{ url: string }>('/upload-avatar', {
    method: 'POST',
    body: { image },
  })
}
