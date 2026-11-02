import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { apiError, mockApi, signedIn } from '../test/api.js'
import { renderApp } from '../test/render.jsx'

const DECK = { id: 7, name: 'Biology', card_count: 3, due_count: 2 }

const currentPath = () => screen.getByTestId('location').textContent

test('lists decks with their counts and links', async () => {
  mockApi({
    ...signedIn,
    'GET /decks': [DECK, { id: 8, name: 'History', card_count: 1, due_count: 0 }],
  })

  renderApp('/')

  const [biology, history] = await screen.findAllByRole('listitem')
  expect(within(biology).getByRole('link', { name: /Biology/ })).toHaveAttribute('href', '/decks/7')
  expect(biology).toHaveTextContent('3 cards')
  expect(within(biology).getByRole('link', { name: 'Study 2 due' })).toHaveAttribute(
    'href',
    '/decks/7/study',
  )
  expect(history).toHaveTextContent('1 card')
  expect(within(history).queryByRole('link', { name: /Study/ })).not.toBeInTheDocument()
})

test('explains the empty state', async () => {
  mockApi({ ...signedIn, 'GET /decks': [] })

  renderApp('/')

  expect(await screen.findByText(/No decks yet/)).toBeInTheDocument()
})

test('creating a deck opens it', async () => {
  const calls = mockApi({
    ...signedIn,
    'GET /decks': [],
    'POST /decks': { ...DECK, card_count: 0, due_count: 0 },
    'GET /decks/7': { ...DECK, card_count: 0, due_count: 0 },
    'GET /decks/7/cards': [],
  })
  const user = renderApp('/')

  await user.type(await screen.findByLabelText('New deck'), 'Biology')
  await user.click(screen.getByRole('button', { name: 'Create deck' }))

  expect(await screen.findByRole('heading', { name: 'Biology' })).toBeInTheDocument()
  expect(currentPath()).toBe('/decks/7')
  expect(calls.find((call) => call.method === 'POST').body).toEqual({ name: 'Biology' })
})

test('the create button needs a name that is not blank', async () => {
  mockApi({ ...signedIn, 'GET /decks': [] })
  const user = renderApp('/')
  const button = await screen.findByRole('button', { name: 'Create deck' })

  expect(button).toBeDisabled()

  await user.type(screen.getByLabelText('New deck'), '   ')

  expect(button).toBeDisabled()
})

test('shows an error when a deck cannot be created', async () => {
  mockApi({ ...signedIn, 'GET /decks': [], 'POST /decks': apiError(500, 'Server error') })
  const user = renderApp('/')

  await user.type(await screen.findByLabelText('New deck'), 'Biology')
  await user.click(screen.getByRole('button', { name: 'Create deck' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Server error')
  expect(screen.getByLabelText('New deck')).toHaveValue('Biology')
})

test('offers a retry when decks fail to load', async () => {
  let attempts = 0
  mockApi({
    ...signedIn,
    'GET /decks': () => {
      attempts += 1
      return attempts === 1 ? apiError(500, 'Server error') : [DECK]
    },
  })
  const user = renderApp('/')

  expect(await screen.findByRole('alert')).toHaveTextContent('Server error')

  await user.click(screen.getByRole('button', { name: 'Try again' }))

  expect(await screen.findByText('Biology')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a session that ends while loading goes to the login page', async () => {
  mockApi({ ...signedIn, 'GET /decks': apiError(401, 'Not authenticated') })

  renderApp('/')

  expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
})
