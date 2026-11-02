import { expect } from '@playwright/test'

export const PASSWORD = 'correct horse battery'

let counter = 0

export function uniqueEmail(prefix = 'user') {
  counter += 1
  return `${prefix}-${Date.now()}-${counter}@example.com`
}

export async function fillCredentials(page, email, password = PASSWORD) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel(/^Password/).fill(password)
}

export async function register(page, email = uniqueEmail()) {
  await page.goto('/register')
  await fillCredentials(page, email)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
  return email
}

export async function logIn(page, email, password = PASSWORD) {
  await page.goto('/login')
  await fillCredentials(page, email, password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
}
