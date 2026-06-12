import type { UserRole } from '../model/types'

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  volunteer: 'Волонтёр',
  organizer_pending: 'Организатор на рассмотрении',
  organizer: 'Организатор',
  admin: 'Администратор',
}

export function getUserRoleLabel(role: UserRole): string {
  return USER_ROLE_LABEL[role] ?? role
}
