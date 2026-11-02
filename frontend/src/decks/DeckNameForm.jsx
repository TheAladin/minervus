import { useState } from 'react'

import { Button, ErrorMessage, Field, Input } from '../components/ui.jsx'
import { useAction } from '../hooks/useAction.js'

export default function DeckNameForm({ initialName = '', label, submitLabel, onSubmit, onCancel }) {
  const [name, setName] = useState(initialName)
  const { run, pending, error } = useAction()

  function handleSubmit(event) {
    event.preventDefault()
    run(() => onSubmit(name))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <Field label={label}>
            <Input
              required
              maxLength={200}
              autoFocus={Boolean(initialName)}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" disabled={pending || !name.trim()}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="quiet" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
      <ErrorMessage>{error}</ErrorMessage>
    </form>
  )
}
