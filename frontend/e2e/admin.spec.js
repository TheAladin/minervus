import { expect, test } from '@playwright/test'

import { ADMIN_EMAIL, PASSWORD } from './constants.js'
import { fillCredentials, logIn, register, uniqueEmail } from './helpers.js'

async function userRow(page, email) {
  await page.goto('/admin/users')
  return page.getByRole('row', { name: new RegExp(email) })
}

async function newSession(browser) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL })
  return { context, page: await context.newPage() }
}

test('an admin created with the CLI can deactivate and reactivate a user', async ({
  page,
  browser,
}) => {
  const member = await newSession(browser)
  const email = await register(member.page, uniqueEmail('member'))

  await logIn(page, ADMIN_EMAIL)
  await page.getByRole('link', { name: 'Users' }).click()
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()

  const row = await userRow(page, email)
  await expect(row).toContainText('Active')
  page.once('dialog', (dialog) => dialog.accept())
  await row.getByRole('button', { name: 'Deactivate' }).click()
  await expect(row).toContainText('Deactivated')

  // Their existing session stops working.
  await member.page.reload()
  await expect(member.page).toHaveURL(/\/login$/)

  // They can't log back in.
  await fillCredentials(member.page, email)
  await member.page.getByRole('button', { name: 'Log in' }).click()
  await expect(member.page.getByRole('alert')).toHaveText('This account has been deactivated')

  await row.getByRole('button', { name: 'Activate' }).click()
  await expect(row).not.toContainText('Deactivated')

  await member.page.getByRole('button', { name: 'Log in' }).click()
  await expect(member.page.getByRole('button', { name: 'Log out' })).toBeVisible()
  await member.context.close()
})

test('deactivation interrupts someone in the middle of using the app', async ({
  page,
  browser,
}) => {
  const member = await newSession(browser)
  const email = await register(member.page, uniqueEmail('busy'))
  await member.page.getByLabel('New deck').fill('In progress')

  await logIn(page, ADMIN_EMAIL)
  const row = await userRow(page, email)
  page.once('dialog', (dialog) => dialog.accept())
  await row.getByRole('button', { name: 'Deactivate' }).click()
  await expect(row).toContainText('Deactivated')

  await member.page.getByRole('button', { name: 'Create deck' }).click()

  await expect(member.page).toHaveURL(/\/login$/)
  await member.context.close()
})

test('declining the prompt leaves the user active', async ({ page, browser }) => {
  const member = await newSession(browser)
  const email = await register(member.page, uniqueEmail('kept'))

  await logIn(page, ADMIN_EMAIL)
  const row = await userRow(page, email)
  page.once('dialog', (dialog) => dialog.dismiss())
  await row.getByRole('button', { name: 'Deactivate' }).click()

  await expect(row.getByRole('button', { name: 'Deactivate' })).toBeVisible()
  await member.page.reload()
  await expect(member.page.getByRole('button', { name: 'Log out' })).toBeVisible()
  await member.context.close()
})

test('admins have no button to deactivate themselves, and the API refuses', async ({ page }) => {
  await logIn(page, ADMIN_EMAIL)

  const row = await userRow(page, ADMIN_EMAIL)
  await expect(row).toContainText('You')
  await expect(row.getByRole('button')).toHaveCount(0)

  const me = await (await page.request.get('/api/auth/me')).json()
  const response = await page.request.patch(`/api/admin/users/${me.id}`, {
    data: { is_active: false },
  })
  expect(response.status()).toBe(409)
})

test('regular users cannot reach the admin area', async ({ page }) => {
  await register(page)
  await expect(page.getByRole('link', { name: 'Users' })).toBeHidden()

  await page.goto('/admin/users')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()

  expect((await page.request.get('/api/admin/users')).status()).toBe(403)
  const response = await page.request.patch('/api/admin/users/1', { data: { is_active: false } })
  expect(response.status()).toBe(403)
})

test('registration cannot create an admin', async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL })
  const response = await api.post('/api/auth/register', {
    data: { email: uniqueEmail('climber'), password: PASSWORD, role: 'admin' },
  })

  expect(response.status()).toBe(201)
  expect((await response.json()).role).toBe('user')
  expect((await api.get('/api/admin/users')).status()).toBe(403)
  await api.dispose()
})
