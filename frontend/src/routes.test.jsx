import { screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import { routes } from './routes.jsx'
import { mockApi, signedIn, signedOut } from './test/api.js'
import { renderApp } from './test/render.jsx'

function Broken() {
  throw new Error('Rendering failed')
}

test('renders the layout around the home page', async () => {
  mockApi(signedIn)

  renderApp('/')

  expect(await screen.findByRole('button', { name: 'Log out' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Minervus' })).toHaveAttribute('href', '/')
  expect(screen.getByRole('main')).toHaveTextContent('spaced repetition')
})

test('shows a not found page for unknown paths', async () => {
  mockApi(signedOut)

  renderApp('/no/such/page')

  expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to the home page' })).toHaveAttribute('href', '/')
})

test('a crash shows an error page instead of a blank screen', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mockApi(signedOut)
  const [app] = routes
  const broken = { id: 'broken', path: 'broken', element: <Broken /> }

  renderApp('/broken', [{ ...app, children: [broken, ...app.children] }])

  expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument()
})
