import { SearchIcon } from '../components/icons.jsx'
import { EmptyState, LinkButton, LoadError } from '../components/ui.jsx'

/** Shows why a deck couldn't load, with a retry if trying again could help. */
export default function DeckLoadError({ error, onRetry }) {
  // 422 covers addresses like /decks/abc, which also aren't decks.
  if (error.status !== 404 && error.status !== 422) {
    return <LoadError error={error} onRetry={onRetry} />
  }
  return (
    <EmptyState
      level={1}
      icon={<SearchIcon className="size-8" />}
      title="Deck not found"
      action={
        <LinkButton variant="secondary" to="/">
          Back to your decks
        </LinkButton>
      }
    >
      It may have been deleted, or the link may be wrong.
    </EmptyState>
  )
}
