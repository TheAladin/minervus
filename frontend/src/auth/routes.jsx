import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { LoadError, Loading } from '../components/ui.jsx'
import { useAuth } from './useAuth.js'

/** Shown until the first session check has an answer. */
function SessionPending() {
  const { sessionError, retrySessionCheck } = useAuth()

  if (sessionError) return <LoadError error={sessionError} onRetry={retrySessionCheck} />
  return <Loading />
}

/** Sends signed-out people to the login page, and back here after they log in. */
export function RequireAuth() {
  const { user, loggedOut } = useAuth()
  const location = useLocation()

  if (user === undefined) return <SessionPending />
  if (user === null) {
    // After a deliberate logout, the next person shouldn't land on this page.
    return <Navigate to="/login" replace state={loggedOut ? undefined : { from: location }} />
  }
  return <Outlet />
}

/** Keeps signed-in people away from the login and registration pages. */
export function PublicOnly() {
  const { user } = useAuth()
  const location = useLocation()

  if (user === undefined) return <SessionPending />
  if (user) return <Navigate to={location.state?.from ?? '/'} replace />
  return <Outlet />
}
