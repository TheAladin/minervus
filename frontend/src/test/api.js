import { vi } from 'vitest'

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** An error response from the API, for use as a route's result. */
export function apiError(status, detail) {
  return json({ detail }, status)
}

function parseBody(body) {
  if (body === undefined || body instanceof FormData) return body
  return JSON.parse(body)
}

/**
 * Stubs fetch with routes keyed like "POST /decks". Each route is a value to return as
 * JSON, or a function of the request body that returns one. A Response is sent as it is,
 * and null sends a 204. Returns the list of requests made, which grows as they happen.
 */
export function mockApi(routes) {
  const calls = []
  const fetchMock = vi.fn(async (url, init = {}) => {
    const method = init.method ?? 'GET'
    const path = url.replace(/^\/api/, '')
    const body = parseBody(init.body)
    calls.push({ method, path, body })

    const route = routes[`${method} ${path}`]
    if (route === undefined) return apiError(599, `Unmocked request: ${method} ${path}`)

    const result = typeof route === 'function' ? await route(body) : route
    if (result instanceof Response) return result.clone()
    return result === null ? new Response(null, { status: 204 }) : json(result)
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

export const USER = {
  id: 1,
  email: 'ada@example.com',
  role: 'user',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
}

export const signedOut = { 'GET /auth/me': apiError(401, 'Not authenticated') }
export const signedIn = { 'GET /auth/me': USER }
