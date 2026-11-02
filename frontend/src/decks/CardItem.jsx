import { useState } from 'react'

import { request } from '../api/client.js'
import { Button, ErrorMessage } from '../components/ui.jsx'
import { useAction } from '../hooks/useAction.js'
import { describeDue } from '../lib/due.js'
import CardForm from './CardForm.jsx'

export default function CardItem({ card, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const { run, pending, error } = useAction()
  const url = `/decks/${card.deck_id}/cards/${card.id}`

  async function handleSave(sides) {
    onUpdated(await request(url, { method: 'PATCH', json: sides }))
    setEditing(false)
  }

  function handleDelete() {
    if (!window.confirm('Delete this card?')) return
    run(async () => {
      await request(url, { method: 'DELETE' })
      onDeleted(card.id)
    })
  }

  if (editing) {
    return (
      <li className="p-4">
        <CardForm
          initial={card}
          submitLabel="Save"
          onSubmit={handleSave}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className="p-4">
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <p className="font-serif break-words whitespace-pre-wrap">{card.front}</p>
        <p className="break-words whitespace-pre-wrap text-stone-600">{card.back}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-stone-500">{describeDue(card.due_at)}</span>
        <div className="flex gap-1">
          <Button variant="quiet" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="quiet" disabled={pending} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>
      {error && (
        <div className="mt-2">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}
    </li>
  )
}
