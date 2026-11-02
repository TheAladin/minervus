import { useCallback, useState } from 'react'

/** Runs a form or button action, tracking whether it's pending and how it failed. */
export function useAction() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)

  const run = useCallback(async (action) => {
    setPending(true)
    setError(null)
    try {
      await action()
    } catch (caught) {
      setError(caught.message)
    } finally {
      setPending(false)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { run, pending, error, clearError }
}
