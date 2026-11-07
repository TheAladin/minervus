import { useRef, useState } from 'react'

import { Button, ErrorMessage, Field, Textarea } from '../components/ui.jsx'
import { useAction } from '../hooks/useAction.js'

/**
 * A form for a card's two sides. After a successful save it clears itself if
 * `clearOnSave` is set, ready for the next card.
 */
export default function CardForm({
  initial = { front: '', back: '' },
  submitLabel,
  onSubmit,
  onCancel,
  clearOnSave = false,
}) {
  const [front, setFront] = useState(initial.front)
  const [back, setBack] = useState(initial.back)
  const { run, pending, error } = useAction()
  const frontRef = useRef(null)

  function handleSubmit(event) {
    event.preventDefault()
    run(async () => {
      await onSubmit({ front, back })
      if (clearOnSave) {
        setFront('')
        setBack('')
        frontRef.current?.focus()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Front">
          <Textarea
            ref={frontRef}
            rows={3}
            required
            maxLength={10_000}
            placeholder="A question or prompt"
            value={front}
            onChange={(event) => setFront(event.target.value)}
          />
        </Field>
        <Field label="Back">
          <Textarea
            rows={3}
            required
            maxLength={10_000}
            placeholder="The answer"
            value={back}
            onChange={(event) => setBack(event.target.value)}
          />
        </Field>
      </div>
      <ErrorMessage>{error}</ErrorMessage>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="quiet" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={pending || !front.trim() || !back.trim()}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
