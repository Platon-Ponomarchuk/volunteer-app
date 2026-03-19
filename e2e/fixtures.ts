import { readFile } from 'fs/promises'
import { test as base, expect } from '@playwright/test'
import { mockRoutes, getMockFilePath } from './mock-routes'

/** Загружает тела моков из файлов (по одному разу на прогон) */
let cachedMockBodies: string[] | null = null

async function loadMockBodies(): Promise<string[]> {
  if (cachedMockBodies) return cachedMockBodies
  cachedMockBodies = await Promise.all(
    mockRoutes.map((route) => readFile(getMockFilePath(route), 'utf-8'))
  )
  return cachedMockBodies
}

/** Подменяет запросы по правилам из mock-routes данными из e2e/mocks/*.json */
async function setupMockRoutes(page: import('@playwright/test').Page) {
  const bodies = await loadMockBodies()

  await page.route('**/*', (route) => {
    const request = route.request()
    if (request.method() !== 'GET') return route.continue()

    let pathname: string
    try {
      pathname = new URL(request.url()).pathname
    } catch {
      return route.continue()
    }

    for (let i = 0; i < mockRoutes.length; i++) {
      const { pattern } = mockRoutes[i]
      const match =
        typeof pattern === 'string'
          ? pathname.includes(pattern)
          : pattern.test(pathname)
      if (match) {
        return route.fulfill({
          status: 200,
          body: bodies[i],
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }
    return route.continue()
  })
}

export const test = base.extend<{ _mockApi: void }>({
  _mockApi: async ({ page }, use) => {
    await setupMockRoutes(page)
    await use()
  },
})

export { expect }
export { mockRoutes, getMockFilePath, MOCKS_DIR } from './mock-routes'
export { setupMockRoutes }
