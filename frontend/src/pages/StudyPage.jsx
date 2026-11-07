import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { CheckIcon, ClockIcon } from '../components/icons.jsx'
import { BackLink, EmptyState, LinkButton, Loading, PageHeader } from '../components/ui.jsx'
import DeckLoadError from '../decks/DeckLoadError.jsx'
import { useResource } from '../hooks/useResource.js'
import StudySession from '../study/StudySession.jsx'

export default function StudyPage() {
  const { deckId } = useParams()
  const deckUrl = `/decks/${deckId}`
  const deck = useResource(deckUrl)
  const due = useResource(`${deckUrl}/due`)
  // How many cards the finished session completed. Null until it finishes.
  const [completed, setCompleted] = useState(null)

  const loadError = deck.error ?? due.error
  if (loadError) {
    return (
      <DeckLoadError
        error={loadError}
        onRetry={() => {
          deck.reload()
          due.reload()
        }}
      />
    )
  }
  if (deck.data === undefined || due.data === undefined) return <Loading />

  const backToDeck = (
    <LinkButton to={deckUrl} variant="secondary">
      Back to deck
    </LinkButton>
  )

  let content
  if (due.data.length === 0) {
    content = (
      <EmptyState icon={<ClockIcon className="size-8" />} title="Nothing due right now" action={backToDeck}>
        This deck has no cards to review. Check back later.
      </EmptyState>
    )
  } else if (completed !== null) {
    content = (
      <EmptyState
        icon={<CheckIcon className="size-8" />}
        iconClassName="animate-pop bg-success text-white dark:text-black"
        title="Session complete"
        action={backToDeck}
      >
        You reviewed {completed} {completed === 1 ? 'card' : 'cards'}.
      </EmptyState>
    )
  } else {
    content = <StudySession deckId={deckId} cards={due.data} onFinished={setCompleted} />
  }

  return (
    <>
      <BackLink to={deckUrl}>Back to deck</BackLink>
      <PageHeader title={deck.data.name} />
      {content}
    </>
  )
}
