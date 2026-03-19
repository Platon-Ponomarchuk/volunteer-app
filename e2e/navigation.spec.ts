import { test, expect } from './fixtures'

test.describe('Навигация в шапке', () => {
  test('отображаются ссылки Главная, Мероприятия, Вход', async ({ page, _mockApi }) => {
    await page.goto('/')
    const nav = page.getByRole('navigation')
    await expect(nav.getByRole('link', { name: /главная/i })).toBeVisible()
    await expect(nav.getByRole('link', { name: /мероприятия/i })).toBeVisible()
    await expect(nav.getByRole('link', { name: /вход/i })).toBeVisible()
  })

  test('переход на Мероприятия открывает /events', async ({ page, _mockApi }) => {
    await page.goto('/')
    await page.getByRole('navigation').getByRole('link', { name: /мероприятия/i }).click()
    await expect(page).toHaveURL(/\/events/)
  })

  test('переход «Вход» открывает страницу входа', async ({ page, _mockApi }) => {
    await page.goto('/')
    await page.getByRole('navigation').getByRole('link', { name: /вход/i }).click()
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})
