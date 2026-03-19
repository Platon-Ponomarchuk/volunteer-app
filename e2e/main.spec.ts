import { test, expect } from './fixtures'

test.describe('Главная страница', () => {
  test('отображает заголовок и призыв к действию', async ({ page, _mockApi }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /волонтёры/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /смотреть мероприятия/i })).toBeVisible()
  })

  test('есть секция «Популярные мероприятия»', async ({ page, _mockApi }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /популярные мероприятия/i })).toBeVisible()
  })

  test('кнопка «Смотреть мероприятия» ведёт на /events', async ({ page, _mockApi }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /смотреть мероприятия/i }).click()
    await expect(page).toHaveURL(/\/events/)
  })
})
