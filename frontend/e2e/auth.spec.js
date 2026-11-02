import { expect, test } from '@playwright/test'

import { PASSWORD } from './constants.js'
import { fillCredentials, logIn, register, uniqueEmail } from './helpers.js'

test('register, stay signed in across a reload, log out and log back in', async ({ page }) => {
  const email = await register(page)
  await expect(page.getByText(email)).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)

  await logIn(page, email)
  await expect(page).toHaveURL(/\/$/)
})

test('the session cookie is out of reach of page scripts', async ({ page, context }) => {
  await register(page)

  const cookies = await context.cookies()
  const session = cookies.find((cookie) => cookie.name === 'minervus_session')

  expect(session.httpOnly).toBe(true)
  expect(session.sameSite).toBe('Lax')
  expect(await page.evaluate(() => document.cookie)).not.toContain('minervus_session')
})

test('a wrong password shows an error', async ({ page }) => {
  const email = await register(page)
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await fillCredentials(page, email, `not-${PASSWORD}`)
  await page.getByRole('button', { name: 'Log in' }).click()

  await expect(page.getByRole('alert')).toHaveText('Incorrect email or password')
  await expect(page).toHaveURL(/\/login$/)
})

test('registering an existing email shows an error', async ({ page, browser }) => {
  const email = await register(page)
  const otherContext = await browser.newContext({ baseURL: test.info().project.use.baseURL })
  const other = await otherContext.newPage()

  await other.goto('/register')
  await fillCredentials(other, email)
  await other.getByRole('button', { name: 'Create account' }).click()

  await expect(other.getByRole('alert')).toContainText('already exists')
  await otherContext.close()
})

test('registration refuses a short password without calling the server', async ({ page }) => {
  await page.goto('/register')
  await fillCredentials(page, uniqueEmail(), 'short')
  const requests = []
  page.on('request', (request) => requests.push(request.url()))

  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByLabel(/^Password/)).toHaveJSProperty('validity.tooShort', true)
  await expect(page).toHaveURL(/\/register$/)
  expect(requests.filter((url) => url.includes('/api/'))).toEqual([])
})

test('an ended session returns to the login page', async ({ page, context }) => {
  await register(page, uniqueEmail())

  await context.clearCookies()
  await page.reload()

  await expect(page).toHaveURL(/\/login$/)
})
