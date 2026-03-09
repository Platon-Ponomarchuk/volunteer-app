import { useState, type FormEvent } from 'react'
import { Button, Input, Icon } from '@/shared/ui'
import { useToastStore } from '@/shared/store'
import { email, required } from '@/shared/lib'
import { login, type LoginCredentials } from '@/entities/user'
import { useAuthStore } from '@/app/store'
import styles from './LoginForm.module.scss'

export interface LoginFormProps {
  onSuccess?: () => void
  onError?: (message: string) => void
}

export function LoginForm({ onSuccess, onError }: LoginFormProps) {
  const setUser = useAuthStore((s) => s.setUser)
  const addToast = useToastStore((s) => s.addToast)
  const [emailVal, setEmailVal] = useState('')
  const [passwordVal, setPasswordVal] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setEmailError(null)
    setPasswordError(null)
    const eErr = email(emailVal)
    const pErr = required(passwordVal, 'Пароль')
    if (eErr) { setEmailError(eErr); return }
    if (pErr) { setPasswordError(pErr); return }
    setLoading(true)
    try {
      const credentials: LoginCredentials = { email: emailVal.trim(), password: passwordVal }
      const user = await login(credentials)
      setUser(user)
      onSuccess?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка входа. Проверьте данные и попробуйте снова.'
      addToast(msg, 'error')
      onError?.(msg)
      if (msg.includes('Неверный пароль')) {
        setPasswordError(msg)
      } else if (msg.includes('не найден') || msg.includes('Укажите email')) {
        setEmailError(msg)
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <Input
        type="email"
        label="Email"
        value={emailVal}
        onChange={(e) => { setEmailVal(e.target.value); setEmailError(null); setError(null) }}
        error={emailError ?? undefined}
        autoComplete="email"
        fullWidth
        disabled={loading}
      />
      <Input
        type="password"
        label="Пароль"
        value={passwordVal}
        onChange={(e) => { setPasswordVal(e.target.value); setPasswordError(null); setError(null) }}
        error={passwordError ?? undefined}
        autoComplete="current-password"
        fullWidth
        disabled={loading}
      />
      {error && <p className={styles.error} role="alert">{error}</p>}
      <Button type="submit" fullWidth disabled={loading}>
        <Icon name="Login" size={20} />
        {loading ? 'Вход...' : 'Войти'}
      </Button>
    </form>
  )
}
