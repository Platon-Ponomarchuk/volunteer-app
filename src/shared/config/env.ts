/**
 * Конфигурация из переменных окружения.
 * Vite предоставляет env только с префиксом VITE_.
 */

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const
