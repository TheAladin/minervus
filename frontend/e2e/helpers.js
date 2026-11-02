import { expect } from '@playwright/test'

import { PASSWORD } from './constants.js'

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

export async function createDeck(page, name) {
  await page.goto('/')
  await page.getByLabel('New deck').fill(name)
  await page.getByRole('button', { name: 'Create deck' }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
}

export async function addCard(page, front, back) {
  await page.getByLabel('Front').fill(front)
  await page.getByLabel('Back').fill(back)
  await page.getByRole('button', { name: 'Add card' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: front })).toBeVisible()
}
