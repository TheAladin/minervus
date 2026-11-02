import { screen, waitFor, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import { apiError, mockApi, signedIn } from '../test/api.js'
import { renderApp } from '../test/render.jsx'

const DECK = { id: 7, name: 'Biology', card_count: 1, due_count: 1 }
const CARD = {
  id: 11,
  deck_id: 7,
  front: 'What do mitochondria make?',
  back: 'ATP',
  due_at: '2020-01-01T00:00:00Z',
}

const currentPath = () => screen.getByTestId('location').textContent

function deckRoutes(overrides = {}) {
  return { ...signedIn, 'GET /decks/7': DECK, 'GET /decks/7/cards': [CARD], ...overrides }
}

test('shows the deck, its counts and its cards', async () => {
  mockApi(deckRoutes())

  renderApp('/decks/7')

  expect(await screen.findByRole('heading', { name: 'Biology' })).toBeInTheDocument()
  expect(screen.getByText('1 card · 1 due now')).toBeInTheDocument()
  const card = screen.getByRole('listitem')
  expect(card).toHaveTextContent('What do mitochondria make?')
  expect(card).toHaveTextContent('ATP')
  expect(card).toHaveTextContent('Due now')
})

test('offers studying only when cards are due', async () => {
  mockApi(deckRoutes())

  renderApp('/decks/7')

  expect(await screen.findByRole('link', { name: 'Study' })).toHaveAttribute(
    'href',
    '/decks/7/study',
  )
})

test('hides studying when nothing is due', async () => {
  mockApi(deckRoutes({ 'GET /decks/7': { ...DECK, due_count: 0 } }))

  renderApp('/decks/7')

  await screen.findByRole('heading', { name: 'Biology' })
  expect(screen.queryByRole('link', { name: 'Study' })).not.toBeInTheDocument()
})

test('explains an empty deck', async () => {
  mockApi(deckRoutes({ 'GET /decks/7/cards': [] }))

  renderApp('/decks/7')

  expect(await screen.findByText('This deck has no cards yet.')).toBeInTheDocument()
})

test.each([
  [404, '/decks/7'],
  [422, '/decks/abc'],
])('shows not found for a %i', async (status, path) => {
  mockApi({
    ...signedIn,
    [`GET ${path}`]: apiError(status, 'Nope'),
    [`GET ${path}/cards`]: apiError(status, 'Nope'),
  })

  renderApp(path)

  expect(await screen.findByRole('heading', { name: 'Deck not found' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to your decks' })).toHaveAttribute('href', '/')
})

test('offers a retry for other load failures', async () => {
  let attempts = 0
  mockApi(
    deckRoutes({
      'GET /decks/7': () => {
        attempts += 1
        return attempts === 1 ? apiError(500, 'Server error') : DECK
      },
    }),
  )
  const user = renderApp('/decks/7')

  await user.click(await screen.findByRole('button', { name: 'Try again' }))

  expect(await screen.findByRole('heading', { name: 'Biology' })).toBeInTheDocument()
})

test('adding a card shows it, updates the counts and clears the form', async () => {
  const added = { ...CARD, id: 12, front: 'New question', back: 'New answer' }
  let deck = DECK
  const calls = mockApi(
    deckRoutes({
      'GET /decks/7': () => deck,
      'POST /decks/7/cards': () => {
        deck = { ...DECK, card_count: 2, due_count: 2 }
        return added
      },
    }),
  )
  const user = renderApp('/decks/7')

  await user.type(await screen.findByLabelText('Front'), 'New question')
  await user.type(screen.getByLabelText('Back'), 'New answer')
  await user.click(screen.getByRole('button', { name: 'Add card' }))

  expect(await screen.findByText('New question')).toBeInTheDocument()
  expect(await screen.findByText('2 cards · 2 due now')).toBeInTheDocument()
  expect(screen.getByLabelText('Front')).toHaveValue('')
  expect(screen.getByLabelText('Back')).toHaveValue('')
  expect(screen.getByLabelText('Front')).toHaveFocus()
  expect(calls.find((call) => call.method === 'POST').body).toEqual({
    front: 'New question',
    back: 'New answer',
  })
})

test('a deck deleted elsewhere shows not found when the counts refresh', async () => {
  let deleted = false
  mockApi(
    deckRoutes({
      'GET /decks/7': () => (deleted ? apiError(404, 'Deck not found') : DECK),
      'POST /decks/7/cards': () => {
        deleted = true
        return { ...CARD, id: 12 }
      },
    }),
  )
  const user = renderApp('/decks/7')

  await user.type(await screen.findByLabelText('Front'), 'Question')
  await user.type(screen.getByLabelText('Back'), 'Answer')
  await user.click(screen.getByRole('button', { name: 'Add card' }))

  expect(await screen.findByRole('heading', { name: 'Deck not found' })).toBeInTheDocument()
})

test('a failed count refresh keeps the page and what is being typed', async () => {
  let failing = false
  mockApi(
    deckRoutes({
      'GET /decks/7': () => (failing ? apiError(500, 'Server error') : DECK),
      'POST /decks/7/cards': () => {
        failing = true
        return { ...CARD, id: 12, front: 'Added' }
      },
    }),
  )
  const user = renderApp('/decks/7')

  await user.type(await screen.findByLabelText('Front'), 'Added')
  await user.type(screen.getByLabelText('Back'), 'Answer')
  await user.click(screen.getByRole('button', { name: 'Add card' }))
  await screen.findByText('Added')
  await user.type(screen.getByLabelText('Front'), 'Half-typed')

  expect(screen.getByRole('heading', { name: 'Biology' })).toBeInTheDocument()
  expect(screen.getByLabelText('Front')).toHaveValue('Half-typed')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a failed add keeps what was typed and shows the error', async () => {
  mockApi(deckRoutes({ 'POST /decks/7/cards': apiError(500, 'Server error') }))
  const user = renderApp('/decks/7')

  await user.type(await screen.findByLabelText('Front'), 'Keep me')
  await user.type(screen.getByLabelText('Back'), 'Me too')
  await user.click(screen.getByRole('button', { name: 'Add card' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Server error')
  expect(screen.getByLabelText('Front')).toHaveValue('Keep me')
})

test('the add button needs text on both sides', async () => {
  mockApi(deckRoutes())
  const user = renderApp('/decks/7')
  const button = await screen.findByRole('button', { name: 'Add card' })

  await user.type(screen.getByLabelText('Front'), 'Only one side')

  expect(button).toBeDisabled()
})

test('editing a card saves the change', async () => {
  const calls = mockApi(
    deckRoutes({ 'PATCH /decks/7/cards/11': { ...CARD, back: 'Adenosine triphosphate' } }),
  )
  const user = renderApp('/decks/7')
  const card = await screen.findByRole('listitem')

  await user.click(within(card).getByRole('button', { name: 'Edit' }))
  const back = within(card).getByLabelText('Back')
  expect(back).toHaveValue('ATP')
  await user.clear(back)
  await user.type(back, 'Adenosine triphosphate')
  await user.click(within(card).getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('Adenosine triphosphate')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  expect(calls.find((call) => call.method === 'PATCH').body.back).toBe('Adenosine triphosphate')
})

test('cancelling an edit discards it', async () => {
  const calls = mockApi(deckRoutes())
  const user = renderApp('/decks/7')
  const card = await screen.findByRole('listitem')

  await user.click(within(card).getByRole('button', { name: 'Edit' }))
  await user.type(within(card).getByLabelText('Back'), ' changed')
  await user.click(within(card).getByRole('button', { name: 'Cancel' }))

  expect(screen.getByRole('listitem')).toHaveTextContent('ATP')
  expect(screen.getByRole('listitem')).not.toHaveTextContent('changed')
  expect(calls.some((call) => call.method === 'PATCH')).toBe(false)
})

test('deleting a card asks first', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const calls = mockApi(deckRoutes({ 'DELETE /decks/7/cards/11': null }))
  const user = renderApp('/decks/7')
  const card = await screen.findByRole('listitem')

  await user.click(within(card).getByRole('button', { name: 'Delete' }))

  expect(confirm).toHaveBeenCalled()
  expect(calls.some((call) => call.method === 'DELETE')).toBe(false)

  confirm.mockReturnValue(true)
  await user.click(within(card).getByRole('button', { name: 'Delete' }))

  expect(await screen.findByText('This deck has no cards yet.')).toBeInTheDocument()
})

test('a failed card delete keeps the card and shows the error', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  mockApi(deckRoutes({ 'DELETE /decks/7/cards/11': apiError(500, 'Server error') }))
  const user = renderApp('/decks/7')

  await user.click(await screen.findByRole('button', { name: 'Delete' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Server error')
  expect(screen.getByText('ATP')).toBeInTheDocument()
})

test('renaming a deck updates the title', async () => {
  const calls = mockApi(deckRoutes({ 'PATCH /decks/7': { ...DECK, name: 'Chemistry' } }))
  const user = renderApp('/decks/7')

  await user.click(await screen.findByRole('button', { name: 'Rename' }))
  const name = screen.getByLabelText('Deck name')
  expect(name).toHaveValue('Biology')
  await user.clear(name)
  await user.type(name, 'Chemistry')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByRole('heading', { name: 'Chemistry' })).toBeInTheDocument()
  expect(calls.find((call) => call.method === 'PATCH').body).toEqual({ name: 'Chemistry' })
})

test('deleting a deck asks first and returns to the list', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  mockApi(deckRoutes({ 'DELETE /decks/7': null, 'GET /decks': [] }))
  const user = renderApp('/decks/7')

  await user.click(await screen.findByRole('button', { name: 'Delete deck' }))

  expect(confirm.mock.calls[0][0]).toContain('Biology')
  await waitFor(() => expect(currentPath()).toBe('/'))
})

test('declining the deck delete prompt keeps the deck', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  const calls = mockApi(deckRoutes())
  const user = renderApp('/decks/7')

  await user.click(await screen.findByRole('button', { name: 'Delete deck' }))

  expect(calls.some((call) => call.method === 'DELETE')).toBe(false)
  expect(currentPath()).toBe('/decks/7')
})

test('card text is shown as text and not as markup', async () => {
  mockApi(
    deckRoutes({
      'GET /decks/7/cards': [{ ...CARD, front: '<img src=x onerror=alert(1)>' }],
    }),
  )

  renderApp('/decks/7')

  expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
  expect(document.querySelector('img')).toBeNull()
})
