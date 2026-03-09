import { Input, Icon } from '@/shared/ui'
import type { Category } from '@/entities/category'
import type { EventFiltersState } from '../../model/types'
import styles from './EventFilters.module.scss'

export interface EventFiltersProps {
  filters: EventFiltersState
  categories: Category[]
  onChange: (filters: EventFiltersState) => void
  className?: string
}

export function EventFilters({ filters, categories, onChange, className }: EventFiltersProps) {
  const update = (patch: Partial<EventFiltersState>) => {
    onChange({ ...filters, ...patch })
  }

  return (
    <div className={`${styles.filters} ${className ?? ''}`}>
      <Input
        type="search"
        placeholder="Поиск по названию..."
        value={filters.search ?? ''}
        onChange={(e) => update({ search: e.target.value || undefined })}
        className={styles.search}
        leftAddon={<Icon name="Search" size={20} />}
      />
      <div className={styles.filterGroup}>
        <Icon name="Filter" size={20} className={styles.filterIcon} />
        <select
          className={styles.select}
          value={filters.categoryId ?? ''}
          onChange={(e) => update({ categoryId: e.target.value || undefined })}
          aria-label="Категория"
        >
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <Input
        type="text"
        placeholder="Город"
        value={filters.city ?? ''}
        onChange={(e) => update({ city: e.target.value || undefined })}
        className={styles.input}
        leftAddon={<Icon name="LocationOn" size={20} />}
      />
      <div className={styles.dateRow}>
        <Input
          type="date"
          label="С"
          value={filters.dateFrom ?? ''}
          onChange={(e) => update({ dateFrom: e.target.value || undefined })}
          className={styles.input}
          leftAddon={<Icon name="Calendar" size={20} />}
        />
        <Input
          type="date"
          label="По"
          value={filters.dateTo ?? ''}
          onChange={(e) => update({ dateTo: e.target.value || undefined })}
          className={styles.input}
          leftAddon={<Icon name="Calendar" size={20} />}
        />
      </div>
    </div>
  )
}
