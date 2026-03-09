import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui'
import { ROUTES } from '@/shared/constants'
import { useToastStore } from '@/shared/store'
import {
  getEventRequests,
  getEventRequestById,
  approveEventRequest,
  rejectEventRequest,
} from '@/entities/event-request'
import { createEvent, getEvents, updateEvent } from '@/entities/event'
import { getUsers } from '@/entities/user'
import { getAllApplications } from '@/entities/application'
import { RejectEventRequestForm } from '@/features/manage-event-request'
import { formatDate } from '@/shared/lib'
import type { EventRequest } from '@/entities/event-request'
import type { User } from '@/entities/user'
import type { Event } from '@/entities/event'
import styles from './AdminPage.module.scss'

type AdminTab = 'requests' | 'events' | 'users' | 'analytics'

export function AdminPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<AdminTab>('requests')
  const [requests, setRequests] = useState<EventRequest[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [applicationsCount, setApplicationsCount] = useState(0)
  const [requestFilter, setRequestFilter] = useState<'pending' | 'all'>('pending')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const addToast = useToastStore((s) => s.addToast)

  const loadRequests = useCallback(() => {
    return getEventRequests(requestFilter === 'pending' ? { status: 'pending' } : undefined).then(
      setRequests
    )
  }, [requestFilter])

  const loadAll = useCallback(() => {
    setLoading(true)
    Promise.all([
      loadRequests(),
      getUsers().then(setUsers),
      getEvents().then(setEvents),
      getAllApplications().then((list) => setApplicationsCount(list.length)),
    ])
      .finally(() => setLoading(false))
  }, [loadRequests])

  useEffect(() => {
    setLoading(true)
    if (activeTab === 'requests') {
      Promise.all([loadRequests(), getUsers().then(setUsers)]).finally(() => setLoading(false))
    } else {
      loadAll()
    }
  }, [activeTab, loadRequests, loadAll])

  const getUserName = (id: string) => users.find((u) => u.id === id)?.name ?? id

  const handleApprove = async (id: string) => {
    setActionLoading(id)
    try {
      const req = await getEventRequestById(id)
      if (req.status !== 'pending') return
      const p = req.payload
      const event = await createEvent({
        title: p.title,
        description: p.description,
        date: p.date,
        endDate: p.endDate,
        location: p.location,
        city: p.city,
        schedule: p.schedule,
        categoryId: p.categoryId,
        status: 'published',
        organizerId: req.organizerId,
        maxVolunteers: p.maxVolunteers,
        roles: p.roles,
      })
      await approveEventRequest(id, event.id)
      addToast('Заявка одобрена', 'success')
      loadRequests()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Ошибка при одобрении заявки', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectingId) return
    setActionLoading(rejectingId)
    try {
      await rejectEventRequest(rejectingId, reason)
      setRejectingId(null)
      addToast('Заявка отклонена', 'success')
      loadRequests()
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Ошибка при отклонении заявки', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleEventStatus = async (eventId: string, status: Event['status']) => {
    setActionLoading(eventId)
    try {
      await updateEvent(eventId, { status })
      setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, status } : e)))
      addToast(status === 'published' ? 'Мероприятие опубликовано' : 'Мероприятие отменено', 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Ошибка при изменении статуса', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Админ-панель</h1>
        <Button variant="primary" size="sm" onClick={() => navigate(ROUTES.createEvent)}>
          Создать мероприятие
        </Button>
      </div>
      <div className={styles.tabs}>
        <button
          type="button"
          className={activeTab === 'requests' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('requests')}
        >
          Заявки на мероприятия
        </button>
        <button
          type="button"
          className={activeTab === 'events' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('events')}
        >
          Мероприятия
        </button>
        <button
          type="button"
          className={activeTab === 'users' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('users')}
        >
          Пользователи
        </button>
        <button
          type="button"
          className={activeTab === 'analytics' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('analytics')}
        >
          Аналитика
        </button>
      </div>

      {activeTab === 'requests' && (
        <>
          <div className={styles.subTabs}>
            <button
              type="button"
              className={requestFilter === 'pending' ? styles.tabActive : styles.tab}
              onClick={() => setRequestFilter('pending')}
            >
              На рассмотрении
            </button>
            <button
              type="button"
              className={requestFilter === 'all' ? styles.tabActive : styles.tab}
              onClick={() => setRequestFilter('all')}
            >
              Все
            </button>
          </div>
          {loading ? (
            <p>Загрузка...</p>
          ) : requests.length === 0 ? (
            <p className={styles.empty}>Заявок нет</p>
          ) : (
            <ul className={styles.list}>
              {requests.map((req) => (
                <li key={req.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>{req.payload.title}</h2>
                    <span className={styles.status} data-status={req.status}>
                      {req.status === 'pending'
                        ? 'На рассмотрении'
                        : req.status === 'approved'
                          ? 'Одобрена'
                          : 'Отклонена'}
                    </span>
                  </div>
                  <p className={styles.meta}>
                    Организатор: {getUserName(req.organizerId)} · {formatDate(req.createdAt)}
                  </p>
                  <p className={styles.desc}>{req.payload.description}</p>
                  <p className={styles.meta}>
                    Дата: {formatDate(req.payload.date)}
                    {req.payload.city && ` · ${req.payload.city}`}
                    {req.payload.schedule && ` · Расписание: ${req.payload.schedule}`}
                  </p>
                  {req.status === 'rejected' && req.rejectionReason && (
                    <div className={styles.rejection}>
                      <strong>Причина отклонения:</strong> {req.rejectionReason}
                    </div>
                  )}
                  {req.status === 'pending' && (
                    <div className={styles.actions}>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(req.id)}
                        disabled={actionLoading !== null}
                      >
                        {actionLoading === req.id ? '...' : 'Одобрить'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRejectingId(req.id)}
                        disabled={actionLoading !== null}
                      >
                        Отклонить
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {activeTab === 'events' && (
        <>
          {loading ? (
            <p>Загрузка...</p>
          ) : events.length === 0 ? (
            <p className={styles.empty}>Мероприятий нет</p>
          ) : (
            <ul className={styles.list}>
              {events.map((ev) => (
                <li key={ev.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>{ev.title}</h2>
                    <span className={styles.status} data-status={ev.status}>
                      {ev.status === 'draft'
                        ? 'Черновик'
                        : ev.status === 'published'
                          ? 'Опубликовано'
                          : 'Отменено'}
                    </span>
                  </div>
                  <p className={styles.meta}>
                    {formatDate(ev.date)} {ev.city && `· ${ev.city}`}
                  </p>
                  <p className={styles.desc}>{ev.description}</p>
                  {(ev.status === 'draft' || ev.status === 'cancelled') && (
                    <div className={styles.actions}>
                      <Button
                        size="sm"
                        onClick={() => handleEventStatus(ev.id, 'published')}
                        disabled={actionLoading !== null}
                      >
                        {actionLoading === ev.id ? '...' : 'Опубликовать'}
                      </Button>
                    </div>
                  )}
                  {ev.status === 'published' && (
                    <div className={styles.actions}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEventStatus(ev.id, 'cancelled')}
                        disabled={actionLoading !== null}
                      >
                        {actionLoading === ev.id ? '...' : 'Отменить'}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {activeTab === 'users' && (
        <>
          {loading ? (
            <p>Загрузка...</p>
          ) : users.length === 0 ? (
            <p className={styles.empty}>Пользователей нет</p>
          ) : (
            <ul className={styles.list}>
              {users.map((u) => (
                <li key={u.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>{u.name}</h2>
                    <span className={styles.userRole}>{u.role}</span>
                  </div>
                  <p className={styles.meta}>Email: {u.email}</p>
                  {u.phone && <p className={styles.meta}>Телефон: {u.phone}</p>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {activeTab === 'analytics' && (
        <div className={styles.analytics}>
          {loading ? (
            <p>Загрузка...</p>
          ) : (
            <>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{events.length}</span>
                <span className={styles.statLabel}>Мероприятий</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{applicationsCount}</span>
                <span className={styles.statLabel}>Заявок волонтёров</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>{users.length}</span>
                <span className={styles.statLabel}>Пользователей</span>
              </div>
            </>
          )}
        </div>
      )}

      {rejectingId && (
        <RejectEventRequestForm
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectingId(null)}
          loading={actionLoading === rejectingId}
        />
      )}
    </main>
  )
}
