import { fireEvent, screen, waitFor } from '@testing-library/react'
import { expect, test } from 'vitest'

import { apiError, mockApi, signedIn } from '../test/api.js'
import { renderApp } from '../test/render.jsx'

const DECK = { id: 7, name: 'Biology', card_count: 2, due_count: 2 }
const FIRST = { id: 11, deck_id: 7, front: 'First question', back: 'First answer' }
const SECOND = { id: 12, deck_id: 7, front: 'Second question', back: 'Second answer' }

function studyRoutes(overrides = {}) {
  return {
    ...signedIn,
    'GET /decks/7': DECK,
    'GET /decks/7/due': [FIRST, SECOND],
    'POST /decks/7/cards/11/review': { ...FIRST, interval_days: 1 },
    'POST /decks/7/cards/12/review': { ...SECOND, interval_days: 1 },
    ...overrides,
  }
}

const reviews = (calls) => calls.filter((call) => call.path.endsWith('/review'))
const showAnswer = () => screen.findByRole('button', { name: 'Show answer' })
const rating = (name) => screen.findByRole('button', { name })

test('shows the question first and the answer only when asked', async () => {
  mockApi(studyRoutes())
  const user = renderApp('/decks/7/study')

  expect(await screen.findByText('First question')).toBeInTheDocument()
  expect(screen.queryByText('First answer')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Good' })).not.toBeInTheDocument()
  expect(screen.getByText('2 cards left')).toBeInTheDocument()

  await user.click(await showAnswer())

  expect(screen.getByText('First answer')).toBeInTheDocument()
  for (const name of ['Again', 'Hard', 'Good', 'Easy']) {
    expect(screen.getByRole('button', { name })).toBeInTheDocument()
  }
})

test.each(['Again', 'Hard', 'Good', 'Easy'])('sends the %s rating', async (name) => {
  const calls = mockApi(studyRoutes())
  const user = renderApp('/decks/7/study')

  await user.click(await showAnswer())
  await user.click(screen.getByRole('button', { name }))

  await waitFor(() => expect(reviews(calls)).toHaveLength(1))
  expect(reviews(calls)[0].body).toEqual({ rating: name.toLowerCase() })
  expect(reviews(calls)[0].path).toBe('/decks/7/cards/11/review')
})

test('rating moves to the next card with its answer hidden', async () => {
  mockApi(studyRoutes())
  const user = renderApp('/decks/7/study')

  await user.click(await showAnswer())
  await user.click(screen.getByRole('button', { name: 'Good' }))

  expect(await screen.findByText('Second question')).toBeInTheDocument()
  expect(screen.queryByText('Second answer')).not.toBeInTheDocument()
  expect(screen.getByText('1 card left')).toBeInTheDocument()
})

test('finishing every card shows the summary', async () => {
  mockApi(studyRoutes())
  const user = renderApp('/decks/7/study')

  await user.click(await showAnswer())
  await user.click(screen.getByRole('button', { name: 'Good' }))
  await user.click(await showAnswer())
  await user.click(screen.getByRole('button', { name: 'Easy' }))

  expect(await screen.findByRole('heading', { name: 'Session complete' })).toBeInTheDocument()
  expect(screen.getByText('You reviewed 2 cards.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to deck' })).toHaveAttribute('href', '/decks/7')
})

test('a card rated Again comes back at the end of the session', async () => {
  let attempts = 0
  const calls = mockApi(
    studyRoutes({
      'POST /decks/7/cards/11/review': () => {
        attempts += 1
        return { ...FIRST, interval_days: attempts === 1 ? 0 : 1 }
      },
    }),
  )
  const user = renderApp('/decks/7/study')

  await user.click(await showAnswer())
  await user.click(screen.getByRole('button', { name: 'Again' }))

  expect(await screen.findByText('Second question')).toBeInTheDocument()
  expect(screen.getByText('2 cards left')).toBeInTheDocument()

  await user.click(await showAnswer())
  await user.click(screen.getByRole('button', { name: 'Good' }))

  expect(await screen.findByText('First question')).toBeInTheDocument()
  expect(screen.queryByText('First answer')).not.toBeInTheDocument()
  expect(screen.getByText('1 card left')).toBeInTheDocument()

  await user.click(await showAnswer())
  await user.click(screen.getByRole('button', { name: 'Good' }))

  expect(await screen.findByText('You reviewed 2 cards.')).toBeInTheDocument()
  expect(reviews(calls)).toHaveLength(3)
})

test('Again on the only card shows that card again', async () => {
  mockApi(
    studyRoutes({
      'GET /decks/7/due': [FIRST],
      'POST /decks/7/cards/11/review': { ...FIRST, interval_days: 0 },
    }),
  )
  const user = renderApp('/decks/7/study')

  await user.click(await showAnswer())
  await user.click(screen.getByRole('button', { name: 'Again' }))

  expect(await showAnswer()).toBeInTheDocument()
  expect(screen.getByText('First question')).toBeInTheDocument()
  expect(screen.queryByText('First answer')).not.toBeInTheDocument()
})

test('a failed review keeps the card and allows another try', async () => {
  let attempts = 0
  mockApi(
    studyRoutes({
      'POST /decks/7/cards/11/review': () => {
        attempts += 1
        return attempts === 1 ? apiError(500, 'Server error') : { ...FIRST, interval_days: 1 }
      },
    }),
  )
  const user = renderApp('/decks/7/study')

  await user.click(await showAnswer())
  await user.click(screen.getByRole('button', { name: 'Good' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Server error')
  expect(screen.getByText('First answer')).toBeInTheDocument()

  await user.click(await rating('Good'))

  expect(await screen.findByText('Second question')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test.each([
  [409, "This card isn't due yet"],
  [404, 'Card not found'],
])('a %i from another tab skips the card without counting it', async (status, detail) => {
  mockApi(studyRoutes({ 'POST /decks/7/cards/11/review': apiError(status, detail) }))
  const user = renderApp('/decks/7/study')

  await user.click(await showAnswer())
  await user.click(screen.getByRole('button', { name: 'Good' }))

  expect(await screen.findByText('Second question')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()

  await user.click(await showAnswer())
  await user.click(screen.getByRole('button', { name: 'Good' }))

  expect(await screen.findByText('You reviewed 1 card.')).toBeInTheDocument()
})

test('rating buttons are disabled while a review is being sent', async () => {
  let finish
  mockApi(
    studyRoutes({
      'POST /decks/7/cards/11/review': () =>
        new Promise((resolve) => {
          finish = () => resolve({ ...FIRST, interval_days: 1 })
        }),
    }),
  )
  const user = renderApp('/decks/7/study')

  await user.click(await showAnswer())
  await user.click(screen.getByRole('button', { name: 'Good' }))

  expect(screen.getByRole('button', { name: 'Easy' })).toBeDisabled()
  await waitFor(() => expect(finish).toBeDefined())
  finish()
  expect(await screen.findByText('Second question')).toBeInTheDocument()
})

test('the keyboard works: space reveals and 1 to 4 rate', async () => {
  const calls = mockApi(studyRoutes())
  renderApp('/decks/7/study')
  await showAnswer()

  fireEvent.keyDown(document.body, { key: ' ' })
  expect(screen.getByText('First answer')).toBeInTheDocument()

  fireEvent.keyDown(document.body, { key: '3' })

  expect(await screen.findByText('Second question')).toBeInTheDocument()
  expect(reviews(calls)[0].body).toEqual({ rating: 'good' })

  fireEvent.keyDown(document.body, { key: ' ' })
  fireEvent.keyDown(document.body, { key: '1' })

  await waitFor(() => expect(reviews(calls)).toHaveLength(2))
  expect(reviews(calls)[1].body).toEqual({ rating: 'again' })
})

test('rating keys do nothing before the answer is shown', async () => {
  const calls = mockApi(studyRoutes())
  renderApp('/decks/7/study')
  await showAnswer()

  fireEvent.keyDown(document.body, { key: '3' })

  expect(reviews(calls)).toEqual([])
  expect(screen.queryByText('First answer')).not.toBeInTheDocument()
})

test('a double key press only reviews one card', async () => {
  let finish
  const calls = mockApi(
    studyRoutes({
      'POST /decks/7/cards/11/review': () =>
        new Promise((resolve) => {
          finish = () => resolve({ ...FIRST, interval_days: 1 })
        }),
    }),
  )
  renderApp('/decks/7/study')
  await showAnswer()
  fireEvent.keyDown(document.body, { key: ' ' })

  fireEvent.keyDown(document.body, { key: '3' })
  fireEvent.keyDown(document.body, { key: '3' })

  await waitFor(() => expect(finish).toBeDefined())
  finish()
  expect(await screen.findByText('Second question')).toBeInTheDocument()
  expect(reviews(calls)).toHaveLength(1)
  expect(screen.getByText('1 card left')).toBeInTheDocument()
})

test('a held key and shortcuts with modifiers are ignored', async () => {
  const calls = mockApi(studyRoutes())
  renderApp('/decks/7/study')
  await showAnswer()

  fireEvent.keyDown(document.body, { key: ' ', repeat: true })
  expect(screen.queryByText('First answer')).not.toBeInTheDocument()

  fireEvent.keyDown(document.body, { key: ' ' })
  expect(screen.getByText('First answer')).toBeInTheDocument()
  fireEvent.keyDown(document.body, { key: '3', ctrlKey: true })
  fireEvent.keyDown(document.body, { key: '3', metaKey: true })
  fireEvent.keyDown(document.body, { key: '3', repeat: true })

  expect(reviews(calls)).toEqual([])
})

test('space on another focused control is left to that control', async () => {
  mockApi(studyRoutes())
  renderApp('/decks/7/study')
  await showAnswer()

  fireEvent.keyDown(screen.getByRole('button', { name: 'Log out' }), { key: ' ' })
  expect(screen.queryByText('First answer')).not.toBeInTheDocument()

  fireEvent.keyDown(document.body, { key: ' ' })
  expect(screen.getByText('First answer')).toBeInTheDocument()
})

test('explains when nothing is due', async () => {
  mockApi(studyRoutes({ 'GET /decks/7/due': [] }))

  renderApp('/decks/7/study')

  expect(await screen.findByRole('heading', { name: 'Nothing due right now' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to deck' })).toBeInTheDocument()
})

test('shows not found for a deck that is not there', async () => {
  mockApi({
    ...signedIn,
    'GET /decks/7': apiError(404, 'Deck not found'),
    'GET /decks/7/due': apiError(404, 'Deck not found'),
  })

  renderApp('/decks/7/study')

  expect(await screen.findByRole('heading', { name: 'Deck not found' })).toBeInTheDocument()
})

test('offers a retry when the session fails to load', async () => {
  let attempts = 0
  mockApi(
    studyRoutes({
      'GET /decks/7/due': () => {
        attempts += 1
        return attempts === 1 ? apiError(500, 'Server error') : [FIRST]
      },
    }),
  )
  const user = renderApp('/decks/7/study')

  await user.click(await screen.findByRole('button', { name: 'Try again' }))

  expect(await screen.findByText('First question')).toBeInTheDocument()
})
