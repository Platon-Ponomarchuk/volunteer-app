import { useState, type FormEvent } from 'react'
import { Button, Input } from '@/shared/ui'
import { useToastStore } from '@/shared/store'
import { required, email, minLength } from '@/shared/lib'
import { register, type RegisterData } from '@/entities/user'
import { useAuthStore } from '@/app/store'
import styles from './RegisterForm.module.scss'

export interface RegisterFormProps {
  onSuccess?: () => void
  onError?: (message: string) => void
}

export function RegisterForm({ onSuccess, onError }: RegisterFormProps) {
  const setUser = useAuthStore((s) => s.setUser)
  const addToast = useToastStore((s) => s.addToast)
  const [nameVal, setNameVal] = useState('')
  const [emailVal, setEmailVal] = useState('')
  const [passwordVal, setPasswordVal] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setNameError(null)
    setEmailError(null)
    setPasswordError(null)
    const nErr = required(nameVal, 'Имя')
    const eErr = email(emailVal)
    const pErr = required(passwordVal, 'Пароль') ?? minLength(passwordVal, 6, 'Пароль')
    if (nErr) { setNameError(nErr); return }
    if (eErr) { setEmailError(eErr); return }
    if (pErr) { setPasswordError(pErr); return }
    setLoading(true)
    try {
      const data: RegisterData = { email: emailVal.trim(), password: passwordVal, name: nameVal.trim() }
      const user = await register(data)
      setUser(user)
      onSuccess?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка регистрации. Возможно, такой email уже занят.'
      addToast(msg, 'error')
      onError?.(msg)
      setEmailError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <Input
        type="text"
        label="Имя"
        value={nameVal}
        onChange={(e) => { setNameVal(e.target.value); setNameError(null); setError(null) }}
        error={nameError ?? undefined}
        autoComplete="name"
        fullWidth
        disabled={loading}
      />
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
        placeholder="Минимум 6 символов"
        autoComplete="new-password"
        fullWidth
        disabled={loading}
      />
      {error && <p className={styles.error} role="alert">{error}</p>}
      <Button type="submit" fullWidth disabled={loading}>
        {loading ? 'Регистрация...' : 'Зарегистрироваться'}
      </Button>
    </form>
  )
}
