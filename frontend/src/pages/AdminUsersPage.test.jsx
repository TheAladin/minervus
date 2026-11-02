import { screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import { apiError, mockApi, USER } from '../test/api.js'
import { renderApp } from '../test/render.jsx'

const ADMIN = { ...USER, id: 2, email: 'root@example.com', role: 'admin' }
const OTHER = { ...USER, id: 3, email: 'grace@example.com' }

function adminRoutes(overrides = {}) {
  return {
    'GET /auth/me': ADMIN,
    'GET /admin/users': [ADMIN, OTHER],
    'GET /decks': [],
    ...overrides,
  }
}

const row = (name) => screen.findByRole('row', { name: new RegExp(name) })

test('lists users with their role and status', async () => {
  mockApi(adminRoutes())

  renderApp('/admin/users')

  const grace = await row('grace@example.com')
  expect(grace).toHaveTextContent('user')
  expect(grace).toHaveTextContent('Active')
  expect(within(grace).getByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
})

test('admins cannot deactivate themselves from the page', async () => {
  mockApi(adminRoutes())

  renderApp('/admin/users')

  const self = await row('root@example.com')
  expect(self).toHaveTextContent('You')
  expect(within(self).queryByRole('button')).not.toBeInTheDocument()
})

test('deactivating a user asks first and updates the row', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  const calls = mockApi(
    adminRoutes({ 'PATCH /admin/users/3': { ...OTHER, is_active: false } }),
  )
  const user = renderApp('/admin/users')
  const grace = await row('grace@example.com')

  await user.click(within(grace).getByRole('button', { name: 'Deactivate' }))

  expect(confirm.mock.calls[0][0]).toContain('grace@example.com')
  expect(await within(grace).findByText('Deactivated')).toBeInTheDocument()
  expect(within(grace).getByRole('button', { name: 'Activate' })).toBeInTheDocument()
  expect(calls.find((call) => call.method === 'PATCH').body).toEqual({ is_active: false })
})

test('declining the prompt changes nothing', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  const calls = mockApi(adminRoutes())
  const user = renderApp('/admin/users')
  const grace = await row('grace@example.com')

  await user.click(within(grace).getByRole('button', { name: 'Deactivate' }))

  expect(calls.some((call) => call.method === 'PATCH')).toBe(false)
  expect(grace).toHaveTextContent('Active')
})

test('activating a user does not ask first', async () => {
  const confirm = vi.spyOn(window, 'confirm')
  const calls = mockApi(
    adminRoutes({
      'GET /admin/users': [ADMIN, { ...OTHER, is_active: false }],
      'PATCH /admin/users/3': OTHER,
    }),
  )
  const user = renderApp('/admin/users')
  const grace = await row('grace@example.com')

  await user.click(within(grace).getByRole('button', { name: 'Activate' }))

  expect(await within(grace).findByRole('button', { name: 'Deactivate' })).toBeInTheDocument()
  expect(confirm).not.toHaveBeenCalled()
  expect(calls.find((call) => call.method === 'PATCH').body).toEqual({ is_active: true })
})

test('a failed update shows the error and leaves the row as it was', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  mockApi(adminRoutes({ 'PATCH /admin/users/3': apiError(500, 'Server error') }))
  const user = renderApp('/admin/users')
  const grace = await row('grace@example.com')

  await user.click(within(grace).getByRole('button', { name: 'Deactivate' }))

  expect(await within(grace).findByRole('alert')).toHaveTextContent('Server error')
  expect(within(grace).getByRole('button', { name: 'Deactivate' })).toBeEnabled()
})

test('offers a retry when users fail to load', async () => {
  let attempts = 0
  mockApi(
    adminRoutes({
      'GET /admin/users': () => {
        attempts += 1
        return attempts === 1 ? apiError(500, 'Server error') : [ADMIN]
      },
    }),
  )
  const user = renderApp('/admin/users')

  await user.click(await screen.findByRole('button', { name: 'Try again' }))

  expect(await row('root@example.com')).toBeInTheDocument()
})

test('admins get a link to the users page', async () => {
  mockApi(adminRoutes())

  renderApp('/')

  expect(await screen.findByRole('link', { name: 'Users' })).toHaveAttribute('href', '/admin/users')
})

test('regular users get no link and see not found without calling the API', async () => {
  const calls = mockApi({ 'GET /auth/me': USER, 'GET /decks': [] })

  renderApp('/admin/users')

  expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument()
  expect(calls.some((call) => call.path.startsWith('/admin'))).toBe(false)
})

test('signed-out people go to the login page', async () => {
  mockApi({ 'GET /auth/me': apiError(401, 'Not authenticated') })

  renderApp('/admin/users')

  expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
})
