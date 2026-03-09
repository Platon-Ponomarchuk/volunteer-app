/** Базовые маршруты приложения */

export const ROUTES = {
  main: '/',
  events: '/events',
  event: '/events/:id',
  eventById: (id: string) => `/events/${id}`,
  myApplications: '/my-applications',
  notifications: '/notifications',
  profile: '/profile',
  createEvent: '/organizer/events/create',
  manageEvent: '/events/:id/manage',
  manageEventById: (id: string) => `/events/${id}/manage`,
  auth: {
    login: '/auth/login',
    register: '/auth/register',
  },
  admin: '/admin',
} as const
