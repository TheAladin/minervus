import { useCallback, useEffect, useMemo, useState } from 'react'

import { request, setUnauthorizedHandler } from '../api/client.js'
import { AuthContext } from './useAuth.js'

export default function AuthProvider({ children }) {
  // undefined while the first session check runs, null when signed out.
  const [user, setUser] = useState(undefined)
  const [loggedOut, setLoggedOut] = useState(false)
  const [sessionError, setSessionError] = useState(null)
  const [sessionChecks, setSessionChecks] = useState(0)

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    request('/auth/me', { signal: controller.signal })
      .then(setUser)
      .catch((error) => {
        if (error.name === 'AbortError') return
        // Only a 401 means signed out. During an outage the cookie may still be good.
        if (error.status === 401) setUser(null)
        else setSessionError(error)
      })
    return () => controller.abort()
  }, [sessionChecks])

  const retrySessionCheck = useCallback(() => {
    setSessionError(null)
    setSessionChecks((count) => count + 1)
  }, [])

  const signIn = useCallback(async (path, credentials) => {
    const signedIn = await request(path, { method: 'POST', json: credentials })
    setLoggedOut(false)
    setUser(signedIn)
  }, [])

  const logout = useCallback(async () => {
    await request('/auth/logout', { method: 'POST' })
    setLoggedOut(true)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loggedOut,
      sessionError,
      retrySessionCheck,
      login: (credentials) => signIn('/auth/login', credentials),
      register: (credentials) => signIn('/auth/register', credentials),
      logout,
    }),
    [user, loggedOut, sessionError, retrySessionCheck, signIn, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
