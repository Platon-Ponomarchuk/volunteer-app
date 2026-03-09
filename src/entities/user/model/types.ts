/** Роли пользователей */

export type UserRole = 'volunteer' | 'organizer' | 'admin'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatar?: string
  phone?: string
  /** Может приходить с API, в UI не отображать */
  password?: string
  createdAt: string
}

export interface UserProfile extends User {
  bio?: string
  skills?: string[]
  interests?: string[]
}
