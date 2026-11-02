import { Link, useNavigate } from 'react-router-dom'

import { request } from '../api/client.js'
import { LinkButton, LoadError, Loading, PageHeader, Panel } from '../components/ui.jsx'
import DeckNameForm from '../decks/DeckNameForm.jsx'
import { useResource } from '../hooks/useResource.js'

function DeckRow({ deck }) {
  return (
    <li className="flex items-center gap-4 pr-4 transition-colors hover:bg-stone-50">
      <Link to={`/decks/${deck.id}`} className="min-w-0 flex-1 p-4">
        <span className="block font-serif text-lg font-medium break-words">{deck.name}</span>
        <span className="block text-sm text-stone-500">
          {deck.card_count} {deck.card_count === 1 ? 'card' : 'cards'}
        </span>
      </Link>
      {deck.due_count > 0 && (
        <LinkButton to={`/decks/${deck.id}/study`} className="shrink-0">
          Study {deck.due_count} due
        </LinkButton>
      )}
    </li>
  )
}

export default function DecksPage() {
  const { data: decks, error, reload } = useResource('/decks')
  const navigate = useNavigate()

  async function handleCreate(name) {
    const deck = await request('/decks', { method: 'POST', json: { name } })
    navigate(`/decks/${deck.id}`)
  }

  return (
    <>
      <PageHeader title="Your decks" />
      <Panel className="mb-6">
        <DeckNameForm label="New deck" submitLabel="Create deck" onSubmit={handleCreate} />
      </Panel>
      {error && <LoadError error={error} onRetry={reload} />}
      {!error && decks === undefined && <Loading />}
      {decks?.length === 0 && (
        <p className="text-sm text-stone-500">
          No decks yet. Create your first one to start adding cards.
        </p>
      )}
      {decks?.length > 0 && (
        <ul className="divide-y divide-stone-200 overflow-hidden rounded-lg border border-stone-200 bg-white">
          {decks.map((deck) => (
            <DeckRow key={deck.id} deck={deck} />
          ))}
        </ul>
      )}
    </>
  )
}
