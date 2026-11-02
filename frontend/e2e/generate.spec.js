import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'

import { createDeck, register } from './helpers.js'

const SAMPLE_PDF = fileURLToPath(new URL('./fixtures/sample.pdf', import.meta.url))

async function clickAndAnswerDialog(page, locator, answer) {
  const answered = new Promise((resolve) => {
    page.once('dialog', (dialog) => dialog[answer]().then(resolve))
  })
  await locator.click()
  await answered
}

async function openGenerator(page) {
  await register(page)
  await createDeck(page, 'Biology')
  const deckUrl = page.url()
  await page.getByRole('link', { name: 'Generate cards with AI' }).click()
  await expect(page.getByRole('heading', { name: 'Generate cards' })).toBeVisible()
  return deckUrl
}

test('generate from pasted text, edit the drafts, save them and study them', async ({ page }) => {
  const deckUrl = await openGenerator(page)

  await page.getByLabel('Text to learn from').fill('Cells have organelles.')
  await page.getByLabel(/^Maximum number of cards/).fill('3')
  await page.getByRole('button', { name: 'Generate cards' }).click()

  const drafts = page.getByRole('listitem')
  await expect(drafts).toHaveCount(3)
  await expect(drafts.first().getByLabel('Back')).toHaveValue('Cells have organelles.')

  await drafts.nth(1).getByLabel('Back').fill('An edited answer')
  await drafts.nth(2).getByRole('button', { name: 'Discard' }).click()
  await expect(drafts).toHaveCount(2)

  // Leaving asks first, and nothing is saved until the user approves it.
  const backLink = page.getByRole('link', { name: 'Back to deck' })
  await clickAndAnswerDialog(page, backLink, 'dismiss')
  await expect(drafts).toHaveCount(2)
  await clickAndAnswerDialog(page, backLink, 'accept')
  await expect(page).toHaveURL(deckUrl)
  await expect(page.getByText('0 cards · 0 due now')).toBeVisible()

  await page.getByRole('link', { name: 'Generate cards with AI' }).click()
  await page.getByLabel('Text to learn from').fill('Cells have organelles.')
  await page.getByRole('button', { name: 'Generate cards' }).click()
  await expect(drafts).toHaveCount(3)
  await drafts.nth(1).getByLabel('Back').fill('An edited answer')
  await drafts.nth(2).getByRole('button', { name: 'Discard' }).click()
  await page.getByRole('button', { name: 'Save 2 cards' }).click()

  await expect(page).toHaveURL(deckUrl)
  await expect(page.getByText('2 cards · 2 due now')).toBeVisible()
  await expect(page.getByText('An edited answer')).toBeVisible()
  await expect(page.getByText('discarding a draft')).toBeHidden()

  await page.getByRole('link', { name: 'Study' }).click()
  await expect(page.getByText('What does the source say?')).toBeVisible()
  await page.getByRole('button', { name: 'Show answer' }).click()
  await page.getByRole('button', { name: 'Good' }).click()
  await page.getByRole('button', { name: 'Show answer' }).click()
  await expect(page.getByText('An edited answer')).toBeVisible()
  await page.getByRole('button', { name: 'Good' }).click()
  await expect(page.getByText('You reviewed 2 cards.')).toBeVisible()
})

test('the browser Back button and reloading also protect drafts', async ({ page }) => {
  await openGenerator(page)
  await page.getByLabel('Text to learn from').fill('Cells have organelles.')
  await page.getByRole('button', { name: 'Generate cards' }).click()
  const drafts = page.getByRole('listitem')
  await expect(drafts).toHaveCount(3)

  page.once('dialog', (dialog) => dialog.dismiss())
  await page.goBack()
  await expect(drafts).toHaveCount(3)
  await expect(page.getByRole('heading', { name: 'Generate cards' })).toBeVisible()

  const dialogTypes = []
  page.once('dialog', (dialog) => {
    dialogTypes.push(dialog.type())
    dialog.accept()
  })
  await page.reload()
  await expect(page.getByLabel('Text to learn from')).toBeVisible()
  expect(dialogTypes).toEqual(['beforeunload'])
})

test('generate from a PDF, using the text extracted from it', async ({ page }) => {
  await openGenerator(page)

  await page.getByText('Upload a PDF').click()
  await expect(page.getByRole('radio', { name: 'Upload a PDF' })).toBeChecked()
  await expect(page.getByRole('radio', { name: 'Paste text' })).not.toBeChecked()
  await page.getByLabel(/^PDF file/).setInputFiles(SAMPLE_PDF)
  await page.getByRole('button', { name: 'Generate cards' }).click()

  const drafts = page.getByRole('listitem')
  await expect(drafts.first().getByLabel('Back')).toHaveValue(
    'Mitochondria are organelles that make ATP for the cell.',
  )
})

test('the card limit is passed through', async ({ page }) => {
  await openGenerator(page)

  await page.getByLabel('Text to learn from').fill('Cells have organelles.')
  await page.getByLabel(/^Maximum number of cards/).fill('1')
  await page.getByRole('button', { name: 'Generate cards' }).click()

  await expect(page.getByRole('button', { name: 'Save 1 card' })).toBeVisible()
})

test('a file that is not a PDF gets a clear error', async ({ page }) => {
  await openGenerator(page)

  await page.getByText('Upload a PDF').click()
  await page.getByLabel(/^PDF file/).setInputFiles({
    name: 'fake.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('this is not a pdf'),
  })
  await page.getByRole('button', { name: 'Generate cards' }).click()

  await expect(page.getByRole('alert')).toHaveText("This file isn't a PDF.")
})

test('AI failures show a clear message and keep the text for another try', async ({ page }) => {
  await openGenerator(page)
  const input = page.getByLabel('Text to learn from')

  await input.fill('TRIGGER_RATE_LIMIT')
  await page.getByRole('button', { name: 'Generate cards' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'The AI service is busy. Try again in a moment.',
  )
  await expect(input).toHaveValue('TRIGGER_RATE_LIMIT')

  await input.fill('TRIGGER_REFUSAL')
  await page.getByRole('button', { name: 'Generate cards' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'The AI declined to write cards from this content.',
  )

  await input.fill('Cells have organelles.')
  await page.getByRole('button', { name: 'Generate cards' }).click()
  await expect(page.getByRole('listitem').first()).toBeVisible()
  await expect(page.getByRole('alert')).toBeHidden()
})
