import { Link, useNavigate } from 'react-router-dom'

import { request } from '../api/client.js'
import { CardsIcon } from '../components/icons.jsx'
import {
  EmptyState,
  LinkButton,
  List,
  LoadError,
  Loading,
  PageHeader,
  Panel,
} from '../components/ui.jsx'
import DeckIcon from '../decks/DeckIcon.jsx'
import DeckNameForm from '../decks/DeckNameForm.jsx'
import { useResource } from '../hooks/useResource.js'

function DeckRow({ deck }) {
  return (
    <li className="relative flex items-center gap-3 pr-4 transition-colors before:absolute before:top-0 before:right-0 before:left-[4.375rem] before:h-px before:bg-line first:before:hidden hover:bg-fill/40">
      <Link
        to={`/decks/${deck.id}`}
        className="flex min-w-0 flex-1 items-center gap-3.5 rounded-2xl py-3.5 pl-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <DeckIcon deck={deck} />
        <span className="min-w-0">
          <span className="block font-semibold break-words">{deck.name}</span>
          <span className="block text-footnote text-ink-muted">
            {deck.card_count} {deck.card_count === 1 ? 'card' : 'cards'}
          </span>
        </span>
      </Link>
      {deck.due_count > 0 && (
        <LinkButton variant="tinted" size="sm" to={`/decks/${deck.id}/study`}>
          Study {deck.due_count} due
        </LinkButton>
      )}
    </li>
  )
}

function dueSummary(decks) {
  const due = decks.reduce((total, deck) => total + deck.due_count, 0)
  if (due === 0) return 'All caught up. Nothing is due right now.'
  return `${due} ${due === 1 ? 'card is' : 'cards are'} due for review.`
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
      <PageHeader title="Your decks" subtitle={decks?.length > 0 && dueSummary(decks)} />
      <Panel className="mb-6">
        <DeckNameForm
          label="New deck"
          placeholder="Spanish vocabulary, Cell biology…"
          submitLabel="Create deck"
          onSubmit={handleCreate}
        />
      </Panel>
      {error && <LoadError error={error} onRetry={reload} />}
      {!error && decks === undefined && <Loading />}
      {decks?.length === 0 && (
        <EmptyState icon={<CardsIcon className="size-8" />} title="No decks yet">
          Create your first one to start adding cards.
        </EmptyState>
      )}
      {decks?.length > 0 && (
        <List divided={false} className="animate-rise">
          {decks.map((deck) => (
            <DeckRow key={deck.id} deck={deck} />
          ))}
        </List>
      )}
    </>
  )
}
