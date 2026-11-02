import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from 'react-router-dom'

import AuthProvider from '../auth/AuthProvider.jsx'
import { routes } from '../routes.jsx'

function WithLocationProbe() {
  const location = useLocation()
  return (
    <>
      <Outlet />
      <div data-testid="location">{location.pathname + location.search}</div>
    </>
  )
}

/** Renders the whole app at a path. The current address is in data-testid="location". */
export function renderApp(path = '/', appRoutes = routes) {
  const user = userEvent.setup()
  const router = createMemoryRouter(
    [{ id: 'location-probe', element: <WithLocationProbe />, children: appRoutes }],
    { initialEntries: [path] },
  )
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
  return user
}
