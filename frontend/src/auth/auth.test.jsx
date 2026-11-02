import { screen, waitFor } from '@testing-library/react'
import { expect, test } from 'vitest'

import {
  apiError,
  mockApi,
  signedIn as signedInSession,
  signedOut as signedOutSession,
  USER,
} from '../test/api.js'
import { renderApp } from '../test/render.jsx'

const DECK = { id: 7, name: 'Biology', card_count: 0, due_count: 0 }
const decks = { 'GET /decks': [DECK], 'GET /decks/7': DECK, 'GET /decks/7/cards': [] }
const signedIn = { ...signedInSession, ...decks }
const signedOut = { ...signedOutSession, ...decks }

const currentPath = () => screen.getByTestId('location').textContent

async function fillCredentials(user, email = USER.email, password = 'correct horse') {
  await user.type(await screen.findByLabelText('Email'), email)
  await user.type(screen.getByLabelText(/^Password/), password)
}

async function logIn(user) {
  await fillCredentials(user)
  await user.click(screen.getByRole('button', { name: 'Log in' }))
}

test('sends signed-out people to the login page', async () => {
  mockApi(signedOut)

  renderApp('/')

  expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  expect(currentPath()).toBe('/login')
  expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
})

test('returns to the requested page after logging in', async () => {
  mockApi({ ...signedOut, 'POST /auth/login': USER })
  const user = renderApp('/decks/7')
  await waitFor(() => expect(currentPath()).toBe('/login'))

  await logIn(user)

  expect(await screen.findByRole('heading', { name: 'Biology' })).toBeInTheDocument()
  expect(currentPath()).toBe('/decks/7')
})

test('keeps the requested page when switching between login and registration', async () => {
  mockApi({ ...signedOut, 'POST /auth/login': USER })
  const user = renderApp('/decks/7')

  await user.click(await screen.findByRole('link', { name: 'Create an account' }))
  await user.click(await screen.findByRole('link', { name: 'Log in' }))
  await logIn(user)

  expect(await screen.findByRole('heading', { name: 'Biology' })).toBeInTheDocument()
  expect(currentPath()).toBe('/decks/7')
})

test('after logging out, the next login starts from the deck list', async () => {
  mockApi({ ...signedIn, 'POST /auth/logout': null, 'POST /auth/login': USER })
  const user = renderApp('/decks/7')

  await user.click(await screen.findByRole('button', { name: 'Log out' }))
  await logIn(user)

  expect(await screen.findByRole('heading', { name: 'Your decks' })).toBeInTheDocument()
  expect(currentPath()).toBe('/')
})

test('after logging out and back in, a session that ends mid-use still returns there', async () => {
  mockApi({
    ...signedIn,
    'POST /auth/logout': null,
    'POST /auth/login': USER,
    'POST /decks/7/cards': apiError(401, 'Not authenticated'),
  })
  const user = renderApp('/')

  await user.click(await screen.findByRole('button', { name: 'Log out' }))
  await logIn(user)
  await user.click(await screen.findByRole('link', { name: /Biology/ }))
  await user.type(await screen.findByLabelText('Front'), 'Question')
  await user.type(screen.getByLabelText('Back'), 'Answer')
  await user.click(screen.getByRole('button', { name: 'Add card' }))
  await waitFor(() => expect(currentPath()).toBe('/login'))
  await logIn(user)

  expect(await screen.findByRole('heading', { name: 'Biology' })).toBeInTheDocument()
  expect(currentPath()).toBe('/decks/7')
})

test('a failed session check offers a retry and does not assume signed out', async () => {
  let attempts = 0
  mockApi({
    ...decks,
    'GET /auth/me': () => {
      attempts += 1
      return attempts === 1 ? apiError(503, 'Backend restarting') : USER
    },
  })
  const user = renderApp('/')

  expect(await screen.findByRole('alert')).toHaveTextContent('Backend restarting')
  expect(currentPath()).toBe('/')
  expect(screen.queryByRole('heading', { name: 'Log in' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Try again' }))

  expect(await screen.findByRole('button', { name: 'Log out' })).toBeInTheDocument()
})

test('logging in shows the user', async () => {
  const calls = mockApi({ ...signedOut, 'POST /auth/login': USER })
  const user = renderApp('/')

  await logIn(user)

  expect(await screen.findByRole('button', { name: 'Log out' })).toBeInTheDocument()
  expect(screen.getByText(USER.email)).toBeInTheDocument()
  await waitFor(() => expect(currentPath()).toBe('/'))
  expect(calls.find((call) => call.path === '/auth/login').body).toEqual({
    email: USER.email,
    password: 'correct horse',
  })
})

test('a failed login shows the error, and trying again clears it', async () => {
  let finish
  mockApi({
    ...signedOut,
    'POST /auth/login': () => {
      if (!finish) {
        finish = () => {}
        return apiError(401, 'Incorrect email or password')
      }
      return new Promise((resolve) => {
        finish = () => resolve(USER)
      })
    },
  })
  const user = renderApp('/login')

  await logIn(user)

  expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password')
  expect(currentPath()).toBe('/login')

  await user.click(screen.getByRole('button', { name: 'Log in' }))

  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  finish()
  expect(await screen.findByRole('button', { name: 'Log out' })).toBeInTheDocument()
})

test('the submit button is disabled while logging in', async () => {
  let finish
  mockApi({
    ...signedOut,
    'POST /auth/login': () =>
      new Promise((resolve) => {
        finish = () => resolve(USER)
      }),
  })
  const user = renderApp('/login')

  await logIn(user)

  expect(screen.getByRole('button', { name: 'Log in' })).toBeDisabled()
  await waitFor(() => expect(finish).toBeDefined())
  finish()
  expect(await screen.findByRole('button', { name: 'Log out' })).toBeInTheDocument()
})

test('registering creates the account and signs in', async () => {
  const calls = mockApi({ ...signedOut, 'POST /auth/register': USER })
  const user = renderApp('/login')

  await user.click(await screen.findByRole('link', { name: 'Create an account' }))
  await fillCredentials(user)
  await user.click(screen.getByRole('button', { name: 'Create account' }))

  expect(await screen.findByRole('button', { name: 'Log out' })).toBeInTheDocument()
  expect(calls.find((call) => call.path === '/auth/register').body.email).toBe(USER.email)
})

test('registration shows server errors, such as a duplicate email', async () => {
  mockApi({
    ...signedOut,
    'POST /auth/register': apiError(409, 'An account with this email already exists'),
  })
  const user = renderApp('/register')
  await fillCredentials(user)

  await user.click(screen.getByRole('button', { name: 'Create account' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('already exists')
})

test('registration requires at least 8 characters', async () => {
  mockApi(signedOut)

  renderApp('/register')

  expect(await screen.findByLabelText(/^Password/)).toHaveAttribute('minlength', '8')
})

test('signed-in people are redirected away from the login page', async () => {
  mockApi(signedIn)

  renderApp('/login')

  await waitFor(() => expect(currentPath()).toBe('/'))
  expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
})

test('logging out returns to the login page', async () => {
  const calls = mockApi({ ...signedIn, 'POST /auth/logout': null })
  const user = renderApp('/')

  await user.click(await screen.findByRole('button', { name: 'Log out' }))

  expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  expect(calls.some((call) => call.path === '/auth/logout')).toBe(true)
})

test('a failed logout says so, stays signed in and clears on navigation', async () => {
  mockApi({ ...signedIn, 'POST /auth/logout': apiError(500, 'Server error') })
  const user = renderApp('/')

  await user.click(await screen.findByRole('button', { name: 'Log out' }))

  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't log out. Server error")
  expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()

  await user.click(await screen.findByRole('link', { name: /Biology/ }))

  await screen.findByRole('heading', { name: 'Biology' })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
