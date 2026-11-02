import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { expect, test, vi } from 'vitest'

import { routes } from './routes.jsx'

function renderAt(path, appRoutes = routes) {
  render(<RouterProvider router={createMemoryRouter(appRoutes, { initialEntries: [path] })} />)
}

function Broken() {
  throw new Error('Rendering failed')
}

test('renders the layout around the home page', async () => {
  renderAt('/')

  expect(await screen.findByRole('link', { name: 'Minervus' })).toHaveAttribute('href', '/')
  expect(screen.getByRole('main')).toHaveTextContent('spaced repetition')
})

test('shows a not found page for unknown paths', async () => {
  renderAt('/no/such/page')

  expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to the home page' })).toHaveAttribute('href', '/')
})

test('a crash shows an error page instead of a blank screen', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const [app] = routes
  const broken = { id: 'broken', path: 'broken', element: <Broken /> }

  renderAt('/broken', [{ ...app, children: [broken, ...app.children] }])

  expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument()
})
