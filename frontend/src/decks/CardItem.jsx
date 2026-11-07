import { useState } from 'react'

import { request } from '../api/client.js'
import { Button, ErrorMessage } from '../components/ui.jsx'
import { useAction } from '../hooks/useAction.js'
import { describeDue, isDue } from '../lib/due.js'
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
      <li className="px-5 py-5">
        <CardForm
          initial={card}
          submitLabel="Save"
          onSubmit={handleSave}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  const due = isDue(card.due_at)

  return (
    <li className="group animate-rise px-5 pt-4 pb-3">
      <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
        <p className="font-medium break-words whitespace-pre-wrap">{card.front}</p>
        <p className="break-words whitespace-pre-wrap text-ink-muted">{card.back}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span
          className={`flex items-center gap-1.5 text-footnote ${due ? 'font-medium text-link' : 'text-ink-muted'}`}
        >
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full ${due ? 'bg-accent' : 'bg-ink-faint/60'}`}
          />
          {describeDue(card.due_at)}
        </span>
        <div className="-mr-2 flex gap-0.5 transition-opacity group-focus-within:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100">
          <Button variant="quiet" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="quietDanger" size="sm" disabled={pending} onClick={handleDelete}>
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
