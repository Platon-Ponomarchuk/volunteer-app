import { useState, type FormEvent } from 'react'
import { Button, Input } from '@/shared/ui'
import { createEvent, updateEvent, type CreateEventData, type Event } from '@/entities/event'
import { createEventRequest } from '@/entities/event-request'
import { getCategories, type Category } from '@/entities/category'
import { useAuthStore } from '@/app/store'
import { useEffect } from 'react'
import styles from './CreateEventForm.module.scss'

export interface CreateEventFormProps {
  /** Если передан — режим редактирования */
  initialEvent?: Event | null
  onSuccess?: () => void
  onError?: (message: string) => void
}

export function CreateEventForm({ initialEvent, onSuccess, onError }: CreateEventFormProps) {
  const user = useAuthStore((s) => s.user)
  const [categories, setCategories] = useState<Category[]>([])
  const [title, setTitle] = useState(initialEvent?.title ?? '')
  const [description, setDescription] = useState(initialEvent?.description ?? '')
  const [date, setDate] = useState(initialEvent?.date?.slice(0, 16) ?? '')
  const [endDate, setEndDate] = useState(initialEvent?.endDate?.slice(0, 16) ?? '')
  const [location, setLocation] = useState(initialEvent?.location ?? '')
  const [city, setCity] = useState(initialEvent?.city ?? '')
  const [schedule, setSchedule] = useState(initialEvent?.schedule ?? '')
  const [categoryId, setCategoryId] = useState(initialEvent?.categoryId ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = Boolean(initialEvent?.id)
  const isOrganizerRequest = !isEdit && user?.role === 'organizer'

  useEffect(() => {
    getCategories().then(setCategories)
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    setError(null)
    setLoading(true)
    const data: CreateEventData = {
      title,
      description,
      date: new Date(date).toISOString(),
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
      location,
      city: city || undefined,
      schedule: schedule.trim() || undefined,
      categoryId: categoryId || (categories[0]?.id ?? ''),
      status: initialEvent?.status ?? 'draft',
      organizerId: user.id,
    }
    try {
      if (isEdit && initialEvent) {
        await updateEvent(initialEvent.id, data)
      } else if (isOrganizerRequest) {
        await createEventRequest({
          title: data.title,
          description: data.description,
          date: data.date,
          endDate: data.endDate,
          location: data.location,
          city: data.city,
          schedule: data.schedule,
          categoryId: data.categoryId,
          maxVolunteers: data.maxVolunteers,
          roles: data.roles,
        })
      } else {
        await createEvent(data)
      }
      onSuccess?.()
    } catch {
      const msg = isEdit
        ? 'Не удалось сохранить изменения'
        : isOrganizerRequest
          ? 'Не удалось отправить заявку на создание мероприятия'
          : 'Не удалось создать мероприятие'
      setError(msg)
      onError?.(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <Input
        label="Название"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        fullWidth
        disabled={loading}
      />
      <div className={styles.field}>
        <label htmlFor="create-desc">Описание</label>
        <textarea
          id="create-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={4}
          className={styles.textarea}
          disabled={loading}
        />
      </div>
      <div className={styles.row}>
        <Input
          type="datetime-local"
          label="Дата начала"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          disabled={loading}
        />
        <Input
          type="datetime-local"
          label="Дата окончания"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          disabled={loading}
        />
      </div>
      <Input
        label="Адрес / место"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        required
        fullWidth
        disabled={loading}
      />
      <Input
        label="Город"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        fullWidth
        disabled={loading}
      />
      <div className={styles.field}>
        <label htmlFor="create-schedule">Расписание мероприятия</label>
        <textarea
          id="create-schedule"
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
          placeholder="Время, этапы, программа..."
          rows={2}
          className={styles.textarea}
          disabled={loading}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="create-category">Категория</label>
        <select
          id="create-category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
          className={styles.select}
          disabled={loading}
        >
          <option value="">Выберите категорию</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading
          ? (isEdit ? 'Сохранение...' : isOrganizerRequest ? 'Отправка заявки...' : 'Создание...')
          : isEdit
            ? 'Сохранить'
            : isOrganizerRequest
              ? 'Отправить заявку на создание'
              : 'Создать мероприятие'}
      </Button>
    </form>
  )
}
