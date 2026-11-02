import { expect, test } from '@playwright/test'

import { addCard, createDeck, register } from './helpers.js'

test('studying a card moves its due date forward', async ({ page }) => {
  await register(page)
  await createDeck(page, 'Biology')
  await addCard(page, 'What do mitochondria make?', 'ATP')
  const deckUrl = page.url()
  await expect(page.getByRole('listitem')).toContainText('Due now')
  await expect(page.getByText('1 card · 1 due now')).toBeVisible()

  await page.getByRole('link', { name: 'Study' }).click()
  await expect(page.getByText('What do mitochondria make?')).toBeVisible()
  await expect(page.getByText('ATP')).toBeHidden()

  await page.getByRole('button', { name: 'Show answer' }).click()
  await expect(page.getByText('ATP')).toBeVisible()
  await page.getByRole('button', { name: 'Good' }).click()

  await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible()
  await expect(page.getByText('You reviewed 1 card.')).toBeVisible()

  await page.getByRole('link', { name: 'Back to deck', exact: true }).click()
  await expect(page).toHaveURL(deckUrl)
  await expect(page.getByText('1 card · 0 due now')).toBeVisible()
  await expect(page.getByRole('listitem')).toContainText('Due tomorrow')
  await expect(page.getByRole('link', { name: 'Study' })).toBeHidden()

  await page.reload()
  await expect(page.getByRole('listitem')).toContainText('Due tomorrow')

  await page.goto(`${deckUrl}/study`)
  await expect(page.getByRole('heading', { name: 'Nothing due right now' })).toBeVisible()
})

test('a card rated Again returns until it is passed, and stays due if abandoned', async ({
  page,
}) => {
  await register(page)
  await createDeck(page, 'Biology')
  await addCard(page, 'First question', 'First answer')
  await addCard(page, 'Second question', 'Second answer')
  const deckUrl = page.url()
  await page.goto(`${deckUrl}/study`)

  await page.getByRole('button', { name: 'Show answer' }).click()
  await page.getByRole('button', { name: 'Again' }).click()
  await expect(page.getByText('Second question')).toBeVisible()
  await expect(page.getByText('2 cards left')).toBeVisible()

  await page.getByRole('button', { name: 'Show answer' }).click()
  await page.getByRole('button', { name: 'Easy' }).click()
  await expect(page.getByText('First question')).toBeVisible()
  await expect(page.getByText('1 card left')).toBeVisible()

  await page.goto(deckUrl)
  await expect(page.getByText('2 cards · 1 due now')).toBeVisible()

  await page.goto(`${deckUrl}/study`)
  await expect(page.getByText('First question')).toBeVisible()
  await page.getByRole('button', { name: 'Show answer' }).click()
  await page.getByRole('button', { name: 'Hard' }).click()
  await expect(page.getByText('You reviewed 1 card.')).toBeVisible()
})

test('a whole session works from the keyboard', async ({ page }) => {
  await register(page)
  await createDeck(page, 'Biology')
  await addCard(page, 'First question', 'First answer')
  await addCard(page, 'Second question', 'Second answer')
  await page.getByRole('link', { name: 'Study' }).click()
  await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible()

  await page.keyboard.press('Space')
  await expect(page.getByText('First answer')).toBeVisible()
  await page.keyboard.press('3')
  await expect(page.getByText('Second question')).toBeVisible()
  await expect(page.getByText('Second answer')).toBeHidden()

  await page.keyboard.press('Space')
  await expect(page.getByText('Second answer')).toBeVisible()
  await page.keyboard.press('4')

  await expect(page.getByText('You reviewed 2 cards.')).toBeVisible()
})

test('pressing a rating key twice quickly reviews only one card', async ({ page }) => {
  await register(page)
  await createDeck(page, 'Biology')
  await addCard(page, 'First question', 'First answer')
  await addCard(page, 'Second question', 'Second answer')
  await page.getByRole('link', { name: 'Study' }).click()
  await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Good' })).toBeVisible()

  await page.evaluate(() => {
    for (let i = 0; i < 2; i += 1) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }))
    }
  })

  await expect(page.getByText('Second question')).toBeVisible()
  await expect(page.getByText('1 card left')).toBeVisible()
})

test('a card reviewed in another tab is skipped rather than reviewed twice', async ({
  page,
  context,
}) => {
  await register(page)
  await createDeck(page, 'Biology')
  await addCard(page, 'First question', 'First answer')
  await addCard(page, 'Second question', 'Second answer')
  const studyUrl = `${page.url()}/study`
  await page.goto(studyUrl)
  await expect(page.getByText('First question')).toBeVisible()

  const otherTab = await context.newPage()
  await otherTab.goto(studyUrl)
  await otherTab.getByRole('button', { name: 'Show answer' }).click()
  await otherTab.getByRole('button', { name: 'Good' }).click()
  await expect(otherTab.getByText('Second question')).toBeVisible()
  await otherTab.close()

  await page.getByRole('button', { name: 'Show answer' }).click()
  await page.getByRole('button', { name: 'Good' }).click()

  await expect(page.getByText('Second question')).toBeVisible()
  await expect(page.getByRole('alert')).toBeHidden()
})
