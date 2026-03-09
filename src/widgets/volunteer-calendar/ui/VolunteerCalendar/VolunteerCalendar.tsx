import { useState, useMemo } from 'react'
import { Link } from '@/shared/ui'
import { formatDate } from '@/shared/lib'
import { ROUTES } from '@/shared/constants'
import type { Application } from '@/entities/application'
import styles from './VolunteerCalendar.module.scss'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

function getStatusLabel(status: Application['status']): string {
  switch (status) {
    case 'pending':
      return 'На утверждении'
    case 'approved':
      return 'Одобрено'
    case 'rejected':
      return 'Отклонено'
    default:
      return status
  }
}

export interface VolunteerCalendarProps {
  applications: Application[]
  className?: string
}

/** Ключ даты в локальной временной зоне (YYYY-MM-DD) для сопоставления с ячейками календаря */
function getDateKey(d: string) {
  const dt = new Date(d)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function VolunteerCalendar({ applications, className }: VolunteerCalendarProps) {
  const [viewDate, setViewDate] = useState(() => new Date())
  const [hoveredCell, setHoveredCell] = useState<number | null>(null)
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Application[]>()
    for (const app of applications) {
      if (!app.eventDate) continue
      const key = getDateKey(app.eventDate)
      const list = map.get(key) ?? []
      list.push(app)
      map.set(key, list)
    }
    return map
  }, [applications])

  const days = useMemo(() => {
    const first = new Date(year, month, 1)
    const last = new Date(year, month + 1, 0)
    const start = first.getDay()
    const padStart = start === 0 ? 6 : start - 1
    const total = last.getDate() + padStart
    const rows = Math.ceil(total / 7) * 7
    const result: { date: Date | null; key: string | null; events: Application[] }[] = []
    for (let i = 0; i < padStart; i++) result.push({ date: null, key: null, events: [] })
    for (let d = 1; d <= last.getDate(); d++) {
      const date = new Date(year, month, d)
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      result.push({ date, key, events: eventsByDate.get(key) ?? [] })
    }
    while (result.length < rows) result.push({ date: null, key: null, events: [] })
    return result
  }, [year, month, eventsByDate])

  const prevMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1))
  const nextMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1))

  return (
    <div className={`${styles.calendar} ${className ?? ''}`}>
      <div className={styles.header}>
        <button type="button" onClick={prevMonth} className={styles.nav} aria-label="Предыдущий месяц">
          ←
        </button>
        <h2 className={styles.title}>
          {MONTHS[month]} {year}
        </h2>
        <button type="button" onClick={nextMonth} className={styles.nav} aria-label="Следующий месяц">
          →
        </button>
      </div>
      <div className={styles.weekdays}>
        {WEEKDAYS.map((w) => (
          <span key={w} className={styles.weekday}>
            {w}
          </span>
        ))}
      </div>
      <div className={styles.grid}>
        {days.map((cell, i) => {
          const hasPending = cell.events.some((e) => e.status === 'pending')
          return (
            <div
              key={i}
              className={styles.cellWrapper}
              onMouseEnter={() => setHoveredCell(i)}
              onMouseLeave={() => setHoveredCell(null)}
            >
              <div
                className={`${styles.cell} ${cell.events.length > 0 ? styles.hasEvents : ''} ${hasPending ? styles.hasPending : ''} ${!cell.date ? styles.empty : ''}`}
              >
                {cell.date && (
                  <>
                    <span className={styles.dayNum}>{cell.date.getDate()}</span>
                    {cell.events.length > 0 && (
                      <span className={styles.dot} title={cell.events.map((e) => e.eventTitle).join(', ')} />
                    )}
                  </>
                )}
              </div>
              {hoveredCell === i && cell.events.length > 0 && cell.key && (
                <div className={styles.popup} role="tooltip">
                  <div className={styles.popupDate}>{formatDate(cell.key)}</div>
                  {cell.events.map((app) => (
                    <div key={app.id} className={styles.popupEvent}>
                      <Link to={ROUTES.eventById(app.eventId)} className={styles.popupEventTitle}>
                        {app.eventTitle ?? 'Мероприятие'}
                      </Link>
                      <span
                        className={
                          app.status === 'pending' ? `${styles.popupEventStatus} ${styles.popupEventStatusPending}` : styles.popupEventStatus
                        }
                      >
                        {getStatusLabel(app.status)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className={styles.legend}>
        <span className={styles.legendDot} />
        <span>— дни с мероприятиями</span>
        <span className={styles.legendDotPending} />
        <span>— на утверждении</span>
      </div>
      {applications.filter((a) => a.eventDate).length > 0 && (
        <ul className={styles.eventList}>
          {Array.from(eventsByDate.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([dateKey, apps]) => (
              <li key={dateKey} className={styles.eventItem}>
                <strong>{formatDate(dateKey)}</strong>
                {apps.map((app) => (
                  <Link key={app.id} to={ROUTES.eventById(app.eventId)} className={styles.eventLink}>
                    {app.eventTitle ?? 'Мероприятие'}
                  </Link>
                ))}
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
