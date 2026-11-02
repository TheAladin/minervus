import { useCallback, useEffect, useRef, useState } from 'react'

import { request } from '../api/client.js'
import { Button, ErrorMessage, Panel } from '../components/ui.jsx'

const RATINGS = [
  { value: 'again', label: 'Again', key: '1', colors: 'border-red-300 text-red-800 hover:bg-red-50' },
  {
    value: 'hard',
    label: 'Hard',
    key: '2',
    colors: 'border-amber-300 text-amber-800 hover:bg-amber-50',
  },
  { value: 'good', label: 'Good', key: '3', colors: 'border-teal-300 text-teal-800 hover:bg-teal-50' },
  { value: 'easy', label: 'Easy', key: '4', colors: 'border-sky-300 text-sky-800 hover:bg-sky-50' },
]

function KeyHint({ children }) {
  return (
    <kbd aria-hidden="true" className="hidden font-sans text-xs opacity-60 sm:inline">
      {children}
    </kbd>
  )
}

/** Shows cards one at a time, then calls onFinished with how many were completed. */
export default function StudySession({ deckId, cards, onFinished }) {
  const [queue, setQueue] = useState(cards)
  const [revealed, setRevealed] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const completed = useRef(0)
  // Unlike state, this updates in time to stop a second key press in the same moment.
  const submitting = useRef(false)

  const card = queue[0]
  const cardId = card?.id

  useEffect(() => {
    if (queue.length === 0) onFinished(completed.current)
  }, [queue, onFinished])

  const rate = useCallback(
    async (rating) => {
      if (submitting.current) return
      submitting.current = true
      setPending(true)
      setError(null)
      try {
        const reviewed = await request(`/decks/${deckId}/cards/${cardId}/review`, {
          method: 'POST',
          json: { rating },
        })
        // An interval of 0 means it's still due, so it comes back later in this session.
        if (reviewed.interval_days === 0) {
          setQueue((current) => [...current.filter(({ id }) => id !== cardId), reviewed])
        } else {
          completed.current += 1
          setQueue((current) => current.filter(({ id }) => id !== cardId))
        }
        setRevealed(false)
      } catch (caught) {
        // Reviewed or deleted elsewhere, such as in another tab, so there's nothing to do.
        if (caught.status === 409 || caught.status === 404) {
          setQueue((current) => current.filter(({ id }) => id !== cardId))
          setRevealed(false)
        } else {
          setError(caught.message)
        }
      } finally {
        submitting.current = false
        setPending(false)
      }
    },
    [deckId, cardId],
  )

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      if (!revealed) {
        // A focused control handles the space bar itself.
        if (event.key === ' ' && !event.target.closest?.('a, button, input, textarea')) {
          event.preventDefault()
          setRevealed(true)
        }
        return
      }
      const rating = RATINGS.find(({ key }) => key === event.key)
      if (rating) rate(rating.value)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [revealed, rate])

  if (!card) return null

  return (
    <>
      <p className="mb-3 text-right text-sm text-stone-500">
        {queue.length} {queue.length === 1 ? 'card' : 'cards'} left
      </p>
      <Panel className="mb-4 flex min-h-64 flex-col justify-center gap-6 px-6 py-10 text-center sm:px-10">
        <p className="font-serif text-2xl leading-snug break-words whitespace-pre-wrap">
          {card.front}
        </p>
        {revealed && (
          <>
            <hr className="border-stone-200" />
            <p
              aria-live="polite"
              className="font-serif text-xl leading-snug break-words whitespace-pre-wrap text-stone-700"
            >
              {card.back}
            </p>
          </>
        )}
      </Panel>

      {error && (
        <div className="mb-4">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}

      {revealed ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RATINGS.map(({ value, label, key, colors }) => (
            <Button
              key={value}
              variant="custom"
              className={`py-3 ${colors}`}
              disabled={pending}
              onClick={() => rate(value)}
            >
              {label} <KeyHint>{key}</KeyHint>
            </Button>
          ))}
        </div>
      ) : (
        <Button autoFocus className="w-full py-3" onClick={() => setRevealed(true)}>
          Show answer <KeyHint>Space</KeyHint>
        </Button>
      )}
    </>
  )
}
