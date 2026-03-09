/** Валидация полей форм */

export function required(value: string | undefined | null, fieldName = 'Поле'): string | null {
  if (value === undefined || value === null) return `${fieldName} обязательно`
  const trimmed = String(value).trim()
  return trimmed.length === 0 ? `${fieldName} обязательно` : null
}

export function minLength(value: string | undefined, min: number, fieldName = 'Поле'): string | null {
  if (!value) return null
  return value.length < min ? `${fieldName}: минимум ${min} символов` : null
}

export function email(value: string | undefined | null): string | null {
  const err = required(value, 'Email')
  if (err) return err
  const trimmed = String(value).trim()
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(trimmed) ? null : 'Введите корректный email'
}

export function compose<T>(
  value: T,
  ...validators: ((v: T, ...args: unknown[]) => string | null)[]
): string | null {
  for (const fn of validators) {
    const err = fn(value)
    if (err) return err
  }
  return null
}
