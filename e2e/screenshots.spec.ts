import { test, expect } from './fixtures'

test.describe('Скриншоты', () => {
  test('главная страница', async ({ page, _mockApi }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /волонтёры/i })).toBeVisible()
    await expect(page).toHaveScreenshot('main-page.png')
  })

  test('страница входа', async ({ page, _mockApi }) => {
    await page.goto('/auth/login')
    await expect(page.getByRole('heading', { name: /вход/i })).toBeVisible()
    await expect(page).toHaveScreenshot('login-page.png')
  })

  test('страница регистрации', async ({ page, _mockApi }) => {
    await page.goto('/auth/register')
    await expect(page.getByRole('heading', { name: /регистрация/i })).toBeVisible()
    await expect(page).toHaveScreenshot('register-page.png')
  })

  test('страница мероприятий', async ({ page, _mockApi }) => {
    await page.goto('/events')
    await expect(page).toHaveScreenshot('events-page.png')
  })
})
