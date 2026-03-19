import { test, expect } from './fixtures'

test.describe('Страница входа', () => {
  test('отображается форма входа', async ({ page, _mockApi }) => {
    await page.goto('/auth/login')
    await expect(page.getByRole('heading', { name: /вход/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /зарегистрироваться/i })).toBeVisible()
  })

  test('ссылка «Зарегистрироваться» ведёт на /auth/register', async ({ page, _mockApi }) => {
    await page.goto('/auth/login')
    await page.getByRole('link', { name: /зарегистрироваться/i }).click()
    await expect(page).toHaveURL(/\/auth\/register/)
  })
})

test.describe('Страница регистрации', () => {
  test('открывается по /auth/register', async ({ page, _mockApi }) => {
    await page.goto('/auth/register')
    await expect(page.getByRole('heading', { name: /регистрация/i })).toBeVisible()
  })
})
