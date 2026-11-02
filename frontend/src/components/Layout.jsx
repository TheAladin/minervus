import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../auth/useAuth.js'
import { useAction } from '../hooks/useAction.js'
import { Button, ErrorMessage } from './ui.jsx'

export default function Layout() {
  const { user, logout } = useAuth()
  const { run, error: logoutError, clearError } = useAction()
  const { pathname } = useLocation()

  // Layout stays mounted across pages, so an old error has to be cleared by hand.
  useEffect(() => clearError(), [pathname, clearError])

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4">
          <Link to="/" className="font-serif text-xl font-semibold tracking-tight">
            Minervus
          </Link>
          {user && (
            <nav aria-label="Account" className="flex min-w-0 items-center gap-3">
              <span className="hidden truncate text-sm text-stone-500 sm:inline">{user.email}</span>
              <Button variant="quiet" onClick={() => run(logout)}>
                Log out
              </Button>
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
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
