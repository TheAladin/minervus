import { useCallback, useEffect, useState } from 'react'

import { request } from '../api/client.js'

/** Whether a failed request says the resource is gone, rather than a passing problem. */
function isGone(error) {
  return error.status === 404 || error.status === 422
}

/**
 * Loads an API path. `data` is undefined until the first load finishes. A reload keeps
 * the data on screen if it fails, so a brief problem doesn't replace the page, unless
 * the failure means the resource no longer exists.
 */
export function useResource(path) {
  const [state, setState] = useState({ path, data: undefined, error: null })
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    request(path, { signal }).then(
      (data) => {
        if (!signal.aborted) setState({ path, data, error: null })
      },
      (error) => {
        if (signal.aborted) return
        setState((current) =>
          current.path === path && current.data !== undefined && !isGone(error)
            ? current
            : { path, data: undefined, error },
        )
      },
    )
    return () => controller.abort()
  }, [path, reloads])

  const reload = useCallback(() => setReloads((count) => count + 1), [])
  const setData = useCallback(
    (update) => setState((current) => ({ ...current, data: update(current.data) })),
    [],
  )

  // When the path has just changed, the state still describes the previous path.
  const isCurrent = state.path === path
  return {
    data: isCurrent ? state.data : undefined,
    error: isCurrent ? state.error : null,
    reload,
    setData,
  }
}
