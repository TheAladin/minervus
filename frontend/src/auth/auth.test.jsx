import { act, screen, waitFor } from '@testing-library/react'
import { expect, test } from 'vitest'

import { request } from '../api/client.js'
import { apiError, mockApi, signedIn, signedOut, USER } from '../test/api.js'
import { renderApp } from '../test/render.jsx'

const currentPath = () => screen.getByTestId('location').textContent

async function fillCredentials(user, email = USER.email, password = 'correct horse') {
  await user.type(await screen.findByLabelText('Email'), email)
  await user.type(screen.getByLabelText(/^Password/), password)
}

test('sends signed-out people to the login page', async () => {
  mockApi(signedOut)

  renderApp('/')

  expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  expect(currentPath()).toBe('/login')
  expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
})

test('returns to the requested address after logging in', async () => {
  mockApi({ ...signedOut, 'POST /auth/login': USER })
  const user = renderApp('/?deck=7')
  await waitFor(() => expect(currentPath()).toBe('/login'))

  await fillCredentials(user)
  await user.click(screen.getByRole('button', { name: 'Log in' }))

  await waitFor(() => expect(currentPath()).toBe('/?deck=7'))
})

test('keeps the requested address when switching between login and registration', async () => {
  mockApi({ ...signedOut, 'POST /auth/login': USER })
  const user = renderApp('/?deck=7')

  await user.click(await screen.findByRole('link', { name: 'Create an account' }))
  await user.click(await screen.findByRole('link', { name: 'Log in' }))
  await fillCredentials(user)
  await user.click(screen.getByRole('button', { name: 'Log in' }))

  await waitFor(() => expect(currentPath()).toBe('/?deck=7'))
})

test('after logging out, the next login starts from the home page', async () => {
  mockApi({ ...signedIn, 'POST /auth/logout': null, 'POST /auth/login': USER })
  const user = renderApp('/?deck=7')

  await user.click(await screen.findByRole('button', { name: 'Log out' }))
  await fillCredentials(user)
  await user.click(screen.getByRole('button', { name: 'Log in' }))

  await screen.findByRole('button', { name: 'Log out' })
  await waitFor(() => expect(currentPath()).toBe('/'))
})

test('a 401 from any other request ends the session', async () => {
  mockApi({ ...signedIn, 'GET /decks': apiError(401, 'Not authenticated') })
  renderApp('/')
  await screen.findByRole('button', { name: 'Log out' })

  await act(() => request('/decks').catch(() => {}))

  expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  expect(currentPath()).toBe('/login')
})

test('a failed session check offers a retry and does not assume signed out', async () => {
  let attempts = 0
  mockApi({
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

  await fillCredentials(user)
  await user.click(screen.getByRole('button', { name: 'Log in' }))

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
  await fillCredentials(user)

  await user.click(screen.getByRole('button', { name: 'Log in' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password')
  expect(currentPath()).toBe('/login')

  await user.click(screen.getByRole('button', { name: 'Log in' }))

  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  finish()
  expect(await screen.findByRole('button', { name: 'Log out' })).toBeInTheDocument()
})

test('submitting the form does not reload the page', async () => {
  const submits = []
  const record = (event) => submits.push(event)
  document.addEventListener('submit', record)
  mockApi({ ...signedOut, 'POST /auth/login': USER })
  const user = renderApp('/login')
  await fillCredentials(user)

  await user.click(screen.getByRole('button', { name: 'Log in' }))

  document.removeEventListener('submit', record)
  expect(submits).toHaveLength(1)
  expect(submits[0].defaultPrevented).toBe(true)
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
  await fillCredentials(user)

  await user.click(screen.getByRole('button', { name: 'Log in' }))

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
  const user = renderApp('/no/such/page')

  await user.click(await screen.findByRole('button', { name: 'Log out' }))

  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't log out. Server error")
  expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()

  await user.click(screen.getByRole('link', { name: 'Back to the home page' }))

  await waitFor(() => expect(currentPath()).toBe('/'))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
