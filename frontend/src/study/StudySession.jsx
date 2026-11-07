import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { request } from '../api/client.js'
import { Button, ErrorMessage } from '../components/ui.jsx'

const RATINGS = [
  { value: 'again', label: 'Again', key: '1', color: 'text-danger hover:bg-danger/10' },
  { value: 'hard', label: 'Hard', key: '2', color: 'text-warning hover:bg-warning/10' },
  { value: 'good', label: 'Good', key: '3', color: 'text-success hover:bg-success/10' },
  { value: 'easy', label: 'Easy', key: '4', color: 'text-link hover:bg-accent/10' },
]

// A long side gets smaller, left-aligned text, so that a paragraph stays readable.
function sideSize(text, short, long) {
  return text.length > 120 ? `${long} text-left` : short
}

/** The key for a button, shown only to people with a mouse, who likely have a keyboard. */
function KeyHint({ children }) {
  return (
    <kbd
      aria-hidden="true"
      className="hidden h-5 min-w-5 items-center justify-center rounded-md bg-current/12 px-1.5 font-sans text-caption font-semibold opacity-80 pointer-fine:inline-flex"
    >
      {children}
    </kbd>
  )
}

/** Shows cards one at a time, then calls onFinished with how many were completed. */
export default function StudySession({ deckId, cards, onFinished }) {
  const [queue, setQueue] = useState(cards)
  const [revealed, setRevealed] = useState(false)
  // Counts the cards shown, so each one animates in, even a card that Again brings back.
  const [turn, setTurn] = useState(0)
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
        setTurn((count) => count + 1)
      } catch (caught) {
        // Reviewed or deleted elsewhere, such as in another tab, so there's nothing to do.
        if (caught.status === 409 || caught.status === 404) {
          setQueue((current) => current.filter(({ id }) => id !== cardId))
          setRevealed(false)
          setTurn((count) => count + 1)
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

  // A layout effect, so the keys work from the moment the card is on screen.
  useLayoutEffect(() => {
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

  const done = cards.length - queue.length

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <div aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-700 ease-spring"
            style={{ width: `${(done / cards.length) * 100}%` }}
          />
        </div>
        <p className="text-footnote font-medium text-ink-muted tabular-nums">
          {queue.length} {queue.length === 1 ? 'card' : 'cards'} left
        </p>
      </div>

      <div className="relative mb-12">
        {queue.length > 2 && (
          <div
            aria-hidden="true"
            className="absolute inset-x-10 top-5 -bottom-5 rounded-[2rem] bg-surface/60 shadow-card dark:bg-surface/40"
          />
        )}
        {queue.length > 1 && (
          <div
            aria-hidden="true"
            className="absolute inset-x-5 top-2.5 -bottom-2.5 rounded-[2rem] bg-surface/85 shadow-card dark:bg-surface/70"
          />
        )}
        <div
          key={turn}
          className="relative flex min-h-80 animate-card-in flex-col justify-center rounded-[2rem] bg-surface px-6 py-12 text-center shadow-raised sm:px-12 dark:shadow-none"
        >
          <p
            className={`font-semibold break-words whitespace-pre-wrap ${sideSize(card.front, 'text-title-1 sm:text-[2rem]/[1.25]', 'text-title-3')}`}
          >
            {card.front}
          </p>
          <div
            aria-live="polite"
            className={`grid transition-[grid-template-rows] duration-500 ease-spring ${revealed ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
          >
            <div className="min-h-0 overflow-hidden">
              {revealed && (
                <div className="animate-reveal">
                  <hr className="mx-auto mt-8 mb-7 w-16 border-line" />
                  <p
                    className={`break-words whitespace-pre-wrap text-ink-muted ${sideSize(card.back, 'text-title-3 sm:text-title-2', 'text-body')}`}
                  >
                    {card.back}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}

      {revealed ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {RATINGS.map(({ value, label, key, color }) => (
            <Button
              key={value}
              variant="surface"
              size="lg"
              className={`font-semibold ${color}`}
              disabled={pending}
              onClick={() => rate(value)}
            >
              {label} <KeyHint>{key}</KeyHint>
            </Button>
          ))}
        </div>
      ) : (
        <Button autoFocus size="lg" className="w-full" onClick={() => setRevealed(true)}>
          Show answer <KeyHint>Space</KeyHint>
        </Button>
      )}
    </>
  )
}
