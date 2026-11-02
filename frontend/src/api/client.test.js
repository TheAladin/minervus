import { afterEach, expect, test, vi } from 'vitest'

import { ApiError, request, setUnauthorizedHandler } from './client.js'

afterEach(() => setUnauthorizedHandler(null))

function stubFetch(response) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

test('prefixes the path, defaults to GET and returns parsed JSON', async () => {
  const fetchMock = stubFetch(jsonResponse({ id: 1 }))

  await expect(request('/decks')).resolves.toEqual({ id: 1 })

  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/decks')
  expect(init.method).toBe('GET')
  expect(init.body).toBeUndefined()
})

test('sends JSON bodies with a content type', async () => {
  const fetchMock = stubFetch(jsonResponse({}))

  await request('/decks', { method: 'POST', json: { name: 'Biology' } })

  const [, init] = fetchMock.mock.calls[0]
  expect(init.headers['Content-Type']).toBe('application/json')
  expect(init.body).toBe('{"name":"Biology"}')
})

test('lets the browser set the content type for form data', async () => {
  const fetchMock = stubFetch(jsonResponse({}))
  const form = new FormData()

  await request('/upload', { method: 'POST', form })

  const [, init] = fetchMock.mock.calls[0]
  expect(init.body).toBe(form)
  expect(init.headers).toBeUndefined()
})

test('returns null for 204 responses', async () => {
  stubFetch(new Response(null, { status: 204 }))

  await expect(request('/decks/1', { method: 'DELETE' })).resolves.toBeNull()
})

test('uses the detail string from error responses', async () => {
  stubFetch(jsonResponse({ detail: 'Deck not found' }, 404))

  const error = await request('/decks/1').catch((caught) => caught)

  expect(error).toBeInstanceOf(ApiError)
  expect(error.status).toBe(404)
  expect(error.message).toBe('Deck not found')
})

test('names the field in validation errors', async () => {
  stubFetch(
    jsonResponse({ detail: [{ loc: ['body', 'password'], msg: 'String is too short' }] }, 422),
  )

  await expect(request('/auth/register')).rejects.toThrow('password: String is too short')
})

test('falls back to a generic message when an error has no JSON body', async () => {
  stubFetch(new Response('<html>Bad gateway</html>', { status: 502 }))

  const error = await request('/decks').catch((caught) => caught)

  expect(error.status).toBe(502)
  expect(error.message).toBe('Something went wrong. Try again.')
})

test('treats a success without a JSON body as an error, not as empty data', async () => {
  stubFetch(new Response('<html>A proxy page</html>', { status: 200 }))

  const error = await request('/decks').catch((caught) => caught)

  expect(error).toBeInstanceOf(ApiError)
  expect(error.message).toBe('Something went wrong. Try again.')
})

test('reports network failures clearly', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

  const error = await request('/decks').catch((caught) => caught)

  expect(error).toBeInstanceOf(ApiError)
  expect(error.status).toBe(0)
  expect(error.message).toContain("Couldn't reach the server")
})

test('passes aborts through unchanged', async () => {
  const abort = new DOMException('Aborted', 'AbortError')
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort))

  await expect(request('/decks')).rejects.toBe(abort)
})

test('reports a 401 as an ended session', async () => {
  const handler = vi.fn()
  setUnauthorizedHandler(handler)
  stubFetch(jsonResponse({ detail: 'Not authenticated' }, 401))

  await expect(request('/decks')).rejects.toThrow('Not authenticated')

  expect(handler).toHaveBeenCalledOnce()
})

test('does not treat a 401 from the auth endpoints as an ended session', async () => {
  const handler = vi.fn()
  setUnauthorizedHandler(handler)
  stubFetch(jsonResponse({ detail: 'Incorrect email or password' }, 401))

  await expect(request('/auth/login', { method: 'POST' })).rejects.toThrow('Incorrect')

  expect(handler).not.toHaveBeenCalled()
})

test('passes through an abort that happens while the body downloads', async () => {
  const abort = new DOMException('Aborted', 'AbortError')
  const response = new Response('{}')
  response.json = () => Promise.reject(abort)
  stubFetch(response)

  await expect(request('/decks')).rejects.toBe(abort)
})
