import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { BackLink, LinkButton, Loading, PageHeader } from '../components/ui.jsx'
import DeckLoadError from '../decks/DeckLoadError.jsx'
import { useResource } from '../hooks/useResource.js'
import StudySession from '../study/StudySession.jsx'

function EndMessage({ title, deckUrl, children }) {
  return (
    <div className="py-8 text-center">
      <h2 className="font-serif text-2xl font-semibold">{title}</h2>
      <p className="mt-2 mb-6 text-sm text-stone-500">{children}</p>
      <LinkButton to={deckUrl} variant="secondary">
        Back to deck
      </LinkButton>
    </div>
  )
}

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

  let content
  if (due.data.length === 0) {
    content = (
      <EndMessage title="Nothing due right now" deckUrl={deckUrl}>
        This deck has no cards to review. Check back later.
      </EndMessage>
    )
  } else if (completed !== null) {
    content = (
      <EndMessage title="Session complete" deckUrl={deckUrl}>
        You reviewed {completed} {completed === 1 ? 'card' : 'cards'}.
      </EndMessage>
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
