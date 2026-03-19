import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Базовый каталог с JSON-моками */
export const MOCKS_DIR = path.join(__dirname, 'mocks')

/**
 * Правило мока: при совпадении URL с pattern ответ подменяется данными из file (имя файла в MOCKS_DIR).
 * pattern — строка (pathname должен содержать её) или RegExp для pathname.
 */
export interface MockRoute {
  pattern: string | RegExp
  file: string
}

/** Маршруты: по какому URL какой файл с моком отдавать. Регэкспы только для списков (не /users/123). */
export const mockRoutes: MockRoute[] = [
  { pattern: /^\/events(\?.*)?$/, file: 'events.json' },
  { pattern: /^\/users(\?.*)?$/, file: 'users.json' },
  { pattern: /^\/applications(\?.*)?$/, file: 'applications.json' },
  { pattern: /^\/categories(\?.*)?$/, file: 'categories.json' },
  { pattern: /^\/notifications(\?.*)?$/, file: 'notifications.json' },
]

export function getMockFilePath(route: MockRoute): string {
  return path.join(MOCKS_DIR, route.file)
}
