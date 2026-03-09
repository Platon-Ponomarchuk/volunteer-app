import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Layout } from './Layout'
import { ProtectedRoute } from './providers'
import { ROUTES } from '@/shared/constants'
import {
  MainPage,
  EventsPage,
  EventPage,
  MyApplicationsPage,
  NotificationsPage,
  ProfilePage,
  CreateEventPage,
  ManageEventPage,
  LoginPage,
  RegisterPage,
  AdminPage,
} from '@/pages'

const router = createBrowserRouter([
  {
    path: ROUTES.main,
    element: <Layout />,
    children: [
      { index: true, element: <MainPage /> },
      { path: 'events', element: <EventsPage /> },
      { path: 'events/:id', element: <EventPage /> },
      {
        path: 'events/:id/manage',
        element: (
          <ProtectedRoute role="organizer">
            <ManageEventPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'my-applications',
        element: (
          <ProtectedRoute>
            <MyApplicationsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'notifications',
        element: (
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'organizer/events/create',
        element: (
          <ProtectedRoute role="organizer">
            <CreateEventPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin',
        element: (
          <ProtectedRoute role="admin">
            <AdminPage />
          </ProtectedRoute>
        ),
      },
      { path: 'auth/login', element: <LoginPage /> },
      { path: 'auth/register', element: <RegisterPage /> },
    ],
  },
])

export function Router() {
  return <RouterProvider router={router} />
}
