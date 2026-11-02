import { Link } from 'react-router-dom'

import { LoadError, PageHeader } from '../components/ui.jsx'

/** Shows why a deck couldn't load, with a retry if trying again could help. */
export default function DeckLoadError({ error, onRetry }) {
  // 422 covers addresses like /decks/abc, which also aren't decks.
  if (error.status !== 404 && error.status !== 422) {
    return <LoadError error={error} onRetry={onRetry} />
  }
  return (
    <>
      <PageHeader title="Deck not found" />
      <Link to="/" className="text-sm font-medium underline underline-offset-4">
        Back to your decks
      </Link>
    </>
  )
}
