import { expect, test } from '@playwright/test'

import { addCard, createDeck, fillCredentials, logIn, register } from './helpers.js'

test('create a deck, manage its cards, rename it and delete it', async ({ page }) => {
  await register(page)
  await expect(page.getByText('No decks yet')).toBeVisible()

  await createDeck(page, 'Biology')
  await expect(page.getByText('0 cards · 0 due now')).toBeVisible()

  await addCard(page, 'What do mitochondria make?', 'ATP')
  await addCard(page, 'What do ribosomes make?', 'Proteins')
  await expect(page.getByText('2 cards · 2 due now')).toBeVisible()

  const card = page.getByRole('listitem').filter({ hasText: 'ribosomes' })
  await card.getByRole('button', { name: 'Edit' }).click()
  await page.getByRole('listitem').getByLabel('Back').fill('Polypeptides')
  await page.getByRole('listitem').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Polypeptides')).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await card.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('1 card · 1 due now')).toBeVisible()
  await expect(page.getByText('Polypeptides')).toBeHidden()

  await page.reload()
  await expect(page.getByText('What do mitochondria make?')).toBeVisible()

  await page.getByRole('button', { name: 'Rename' }).click()
  await page.getByLabel('Deck name').fill('Cell biology')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'Cell biology' })).toBeVisible()

  await page.getByRole('link', { name: '← Your decks' }).click()
  const row = page.getByRole('listitem').filter({ hasText: 'Cell biology' })
  await expect(row).toContainText('1 card')
  await expect(row).toContainText('1 due')

  await row.getByRole('link', { name: /Cell biology/ }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete deck' }).click()
  await expect(page.getByText('No decks yet')).toBeVisible()
})

test("another user can't see or reach someone's deck", async ({ page, browser }) => {
  await register(page)
  await createDeck(page, 'Private notes')
  await addCard(page, 'Secret question', 'Secret answer')
  const deckUrl = page.url()

  const otherContext = await browser.newContext({ baseURL: test.info().project.use.baseURL })
  const other = await otherContext.newPage()
  await register(other)

  await expect(other.getByText('No decks yet')).toBeVisible()
  const responses = []
  other.on('response', (response) => {
    if (response.url().includes('/api/decks/')) responses.push(response.status())
  })

  await other.goto(deckUrl)

  await expect(other.getByRole('heading', { name: 'Deck not found' })).toBeVisible()
  await expect(other.getByText('Secret')).toBeHidden()
  expect(responses).toContain(404)
  expect(responses).not.toContain(200)
  await otherContext.close()
})

test('a deep link survives logging in', async ({ page }) => {
  const email = await register(page)
  await createDeck(page, 'Linked deck')
  const deckUrl = page.url()
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.goto(deckUrl)
  await expect(page).toHaveURL(/\/login$/)
  await fillCredentials(page, email)
  await page.getByRole('button', { name: 'Log in' }).click()

  await expect(page).toHaveURL(deckUrl)
  await expect(page.getByRole('heading', { name: 'Linked deck' })).toBeVisible()
})

test('logging out from a deck does not send the next person back to it', async ({ page }) => {
  const email = await register(page)
  await createDeck(page, 'Linked deck')
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await fillCredentials(page, email)
  await page.getByRole('button', { name: 'Log in' }).click()

  await expect(page.getByRole('heading', { name: 'Your decks' })).toBeVisible()
})

test('a session that ends mid-use returns to the same deck after logging in', async ({
  page,
  context,
}) => {
  const email = await register(page)
  await createDeck(page, 'Interrupted')
  const deckUrl = page.url()

  await context.clearCookies()
  await page.getByLabel('Front').fill('Question')
  await page.getByLabel('Back').fill('Answer')
  await page.getByRole('button', { name: 'Add card' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await fillCredentials(page, email)
  await page.getByRole('button', { name: 'Log in' }).click()

  await expect(page).toHaveURL(deckUrl)
})

test('card text is displayed literally', async ({ page }) => {
  await register(page)
  await createDeck(page, '<b>Markup</b>')
  const markup = '<img src=x onerror="document.title=\'hacked\'">'

  await addCard(page, markup, 'Plain back')

  await expect(page.getByText(markup)).toBeVisible()
  await expect(page.getByRole('heading', { name: '<b>Markup</b>' })).toBeVisible()
  await expect(page).toHaveTitle('Minervus')
  await page.reload()
  await expect(page.getByText(markup)).toBeVisible()
  await expect(page).toHaveTitle('Minervus')
})

test('logging back in shows only your own decks', async ({ page }) => {
  const first = await register(page)
  await createDeck(page, 'First users deck')
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await register(page)
  await expect(page.getByText('First users deck')).toBeHidden()
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await logIn(page, first)
  await expect(page.getByText('First users deck')).toBeVisible()
})
