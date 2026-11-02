import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import { apiError, mockApi } from '../test/api.js'
import { useResource } from './useResource.js'

test('loads the path', async () => {
  mockApi({ 'GET /thing': { id: 1 } })

  const { result } = renderHook(() => useResource('/thing'))

  expect(result.current.data).toBeUndefined()
  await waitFor(() => expect(result.current.data).toEqual({ id: 1 }))
  expect(result.current.error).toBeNull()
})

test('reports a failed first load', async () => {
  mockApi({ 'GET /thing': apiError(500, 'Server error') })

  const { result } = renderHook(() => useResource('/thing'))

  await waitFor(() => expect(result.current.error?.message).toBe('Server error'))
  expect(result.current.data).toBeUndefined()
})

test('a reload replaces the data', async () => {
  let version = 1
  mockApi({ 'GET /thing': () => ({ version }) })
  const { result } = renderHook(() => useResource('/thing'))
  await waitFor(() => expect(result.current.data).toEqual({ version: 1 }))

  version = 2
  act(() => result.current.reload())

  await waitFor(() => expect(result.current.data).toEqual({ version: 2 }))
})

test('a failed reload keeps the data on screen', async () => {
  let fail = false
  const calls = mockApi({
    'GET /thing': () => (fail ? apiError(500, 'Server error') : { id: 1 }),
  })
  const { result } = renderHook(() => useResource('/thing'))
  await waitFor(() => expect(result.current.data).toEqual({ id: 1 }))

  fail = true
  act(() => result.current.reload())

  await waitFor(() => expect(calls).toHaveLength(2))
  await act(async () => {})
  expect(result.current.data).toEqual({ id: 1 })
  expect(result.current.error).toBeNull()
})

test('a reload that finds the resource gone reports it', async () => {
  let gone = false
  mockApi({ 'GET /thing': () => (gone ? apiError(404, 'Not found') : { id: 1 }) })
  const { result } = renderHook(() => useResource('/thing'))
  await waitFor(() => expect(result.current.data).toEqual({ id: 1 }))

  gone = true
  act(() => result.current.reload())

  await waitFor(() => expect(result.current.error?.status).toBe(404))
  expect(result.current.data).toBeUndefined()
})

test('a retry after a failed first load clears the error', async () => {
  let fail = true
  mockApi({ 'GET /thing': () => (fail ? apiError(500, 'Server error') : { id: 1 }) })
  const { result } = renderHook(() => useResource('/thing'))
  await waitFor(() => expect(result.current.error).not.toBeNull())

  fail = false
  act(() => result.current.reload())

  await waitFor(() => expect(result.current.data).toEqual({ id: 1 }))
  expect(result.current.error).toBeNull()
})

test('a new path never shows the data of the previous path', async () => {
  mockApi({ 'GET /one': { id: 1 }, 'GET /two': { id: 2 } })
  const { result, rerender } = renderHook(({ path }) => useResource(path), {
    initialProps: { path: '/one' },
  })
  await waitFor(() => expect(result.current.data).toEqual({ id: 1 }))

  rerender({ path: '/two' })

  expect(result.current.data).toBeUndefined()
  await waitFor(() => expect(result.current.data).toEqual({ id: 2 }))
})

test('a response for the previous path is ignored', async () => {
  let finishOld
  const fetchMock = vi.fn((url) =>
    url === '/api/old'
      ? new Promise((resolve) => {
          finishOld = () => resolve(new Response('{"id":"old"}'))
        })
      : Promise.resolve(new Response('{"id":"new"}')),
  )
  vi.stubGlobal('fetch', fetchMock)
  const { result, rerender } = renderHook(({ path }) => useResource(path), {
    initialProps: { path: '/old' },
  })

  rerender({ path: '/new' })
  await waitFor(() => expect(result.current.data).toEqual({ id: 'new' }))
  await act(async () => finishOld())

  expect(result.current.data).toEqual({ id: 'new' })
})

test('an aborted request never ends up as empty data', async () => {
  const abort = new DOMException('Aborted', 'AbortError')
  const aborted = new Response('{}')
  aborted.json = () => Promise.reject(abort)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(aborted))

  const { result, unmount } = renderHook(() => useResource('/thing'))
  await act(async () => {})

  expect(result.current.data).toBeUndefined()
  unmount()
})
