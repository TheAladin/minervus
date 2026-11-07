import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { request } from '../api/client.js'
import { CardsIcon, PlayIcon, SparklesIcon } from '../components/icons.jsx'
import {
  BackLink,
  Button,
  EmptyState,
  ErrorMessage,
  focusRing,
  LinkButton,
  List,
  Loading,
  PageHeader,
  Panel,
} from '../components/ui.jsx'
import CardForm from '../decks/CardForm.jsx'
import CardItem from '../decks/CardItem.jsx'
import DeckIcon from '../decks/DeckIcon.jsx'
import DeckLoadError from '../decks/DeckLoadError.jsx'
import DeckNameForm from '../decks/DeckNameForm.jsx'
import { useAction } from '../hooks/useAction.js'
import { useResource } from '../hooks/useResource.js'

export default function DeckPage() {
  const { deckId } = useParams()
  const url = `/decks/${deckId}`
  const deckResource = useResource(url)
  const cardsResource = useResource(`${url}/cards`)
  const { data: deck, setData: setDeck, reload: reloadDeck } = deckResource
  const { data: cards, setData: setCards } = cardsResource
  const [renaming, setRenaming] = useState(false)
  const deletion = useAction()
  const navigate = useNavigate()

  const loadError = deckResource.error ?? cardsResource.error
  if (loadError) {
    return (
      <DeckLoadError
        error={loadError}
        onRetry={() => {
          deckResource.reload()
          cardsResource.reload()
        }}
      />
    )
  }
  if (deck === undefined || cards === undefined) return <Loading />

  async function handleRename(name) {
    const renamed = await request(url, { method: 'PATCH', json: { name } })
    setDeck(() => renamed)
    setRenaming(false)
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${deck.name}" and all of its cards?`)) return
    deletion.run(async () => {
      await request(url, { method: 'DELETE' })
      navigate('/')
    })
  }

  async function handleAddCard(sides) {
    const card = await request(`${url}/cards`, { method: 'POST', json: sides })
    setCards((current) => [...current, card])
    reloadDeck()
  }

  function handleCardUpdated(updated) {
    setCards((current) => current.map((card) => (card.id === updated.id ? updated : card)))
  }

  function handleCardDeleted(cardId) {
    setCards((current) => current.filter((card) => card.id !== cardId))
    reloadDeck()
  }

  return (
    <>
      <BackLink to="/">Your decks</BackLink>
      {renaming ? (
        <Panel className="mb-8">
          <DeckNameForm
            initialName={deck.name}
            label="Deck name"
            submitLabel="Save"
            onSubmit={handleRename}
            onCancel={() => setRenaming(false)}
          />
        </Panel>
      ) : (
        <PageHeader
          title={deck.name}
          subtitle={`${deck.card_count} ${deck.card_count === 1 ? 'card' : 'cards'} · ${deck.due_count} due now`}
          icon={<DeckIcon deck={deck} className="size-14 rounded-2xl text-title-1 sm:size-16" />}
        >
          {deck.due_count > 0 && (
            <LinkButton to={`${url}/study`}>
              <PlayIcon className="-ml-1 size-4" />
              Study
            </LinkButton>
          )}
          <Button variant="secondary" onClick={() => setRenaming(true)}>
            Rename
          </Button>
          <Button variant="danger" disabled={deletion.pending} onClick={handleDelete}>
            Delete deck
          </Button>
        </PageHeader>
      )}
      {deletion.error && (
        <div className="mb-6">
          <ErrorMessage>{deletion.error}</ErrorMessage>
        </div>
      )}

      <Panel className="mb-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-title-3 font-semibold">Add a card</h2>
          <Link
            to={`${url}/generate`}
            className={`inline-flex items-center gap-1.5 rounded-full bg-ai/10 px-3 py-1.5 text-footnote font-semibold text-ai transition-colors hover:bg-ai/15 ${focusRing}`}
          >
            <SparklesIcon className="size-4" />
            Generate cards with AI
          </Link>
        </div>
        <CardForm submitLabel="Add card" onSubmit={handleAddCard} clearOnSave />
      </Panel>

      <h2 className="mb-3 text-title-3 font-semibold">Cards</h2>
      {cards.length === 0 ? (
        <EmptyState icon={<CardsIcon className="size-8" />}>
          This deck has no cards yet.
        </EmptyState>
      ) : (
        <List>
          {cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              onUpdated={handleCardUpdated}
              onDeleted={handleCardDeleted}
            />
          ))}
        </List>
      )}
    </>
  )
}
