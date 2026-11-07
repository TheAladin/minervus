import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../auth/useAuth.js'
import { useAction } from '../hooks/useAction.js'
import { AppIcon } from './icons.jsx'
import { Button, ErrorMessage, focusRing, LinkButton } from './ui.jsx'

export default function Layout() {
  const { user, logout } = useAuth()
  const { run, error: logoutError, clearError } = useAction()
  const { pathname } = useLocation()

  // Layout stays mounted across pages, so an old error has to be cleared by hand.
  useEffect(() => clearError(), [pathname, clearError])

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/75 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            to="/"
            className={`-ml-1 flex items-center gap-2.5 rounded-lg px-1 text-body font-semibold ${focusRing}`}
          >
            <AppIcon className="size-7" />
            Minervus
          </Link>
          {user && (
            <nav aria-label="Account" className="flex min-w-0 items-center gap-1">
              <span className="mr-2 hidden truncate text-footnote text-ink-muted sm:inline">
                {user.email}
              </span>
              {user.role === 'admin' && (
                <LinkButton variant="quiet" size="sm" to="/admin/users">
                  Users
                </LinkButton>
              )}
              <Button variant="quiet" size="sm" onClick={() => run(logout)}>
                Log out
              </Button>
            </nav>
          )}
        </div>
      </header>
      <main key={pathname} className="mx-auto max-w-3xl animate-fade-in px-4 pt-8 pb-20 sm:px-6 sm:pt-12">
        {logoutError && (
          <div className="mb-6">
            <ErrorMessage>Couldn't log out. {logoutError}</ErrorMessage>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}
