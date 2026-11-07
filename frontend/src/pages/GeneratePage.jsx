import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'

import { request } from '../api/client.js'
import { SparklesIcon } from '../components/icons.jsx'
import { BackLink, Loading, PageHeader, Panel } from '../components/ui.jsx'
import DeckLoadError from '../decks/DeckLoadError.jsx'
import DraftList from '../generate/DraftList.jsx'
import SourceForm from '../generate/SourceForm.jsx'
import { useAction } from '../hooks/useAction.js'
import { useResource } from '../hooks/useResource.js'

const DISCARD_PROMPT = "Discard these draft cards? They haven't been saved."

/** Asks before leaving the page, so edited drafts aren't lost by accident. */
function useDraftGuard(hasDrafts, saved, saving) {
  const blocker = useBlocker(() => hasDrafts && !saved.current)

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    // A save in progress is about to move on by itself, and the drafts aren't at risk.
    if (saving) blocker.reset()
    else if (window.confirm(DISCARD_PROMPT)) blocker.proceed()
    else blocker.reset()
  }, [blocker, saving])

  // Router navigation is covered above, and this covers reloading or closing the tab.
  // A layout effect, so the warning is in place as soon as the drafts are on screen.
  useLayoutEffect(() => {
    if (!hasDrafts) return undefined
    const warn = (event) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasDrafts])
}

export default function GeneratePage() {
  const { deckId } = useParams()
  const deckUrl = `/decks/${deckId}`
  const deck = useResource(deckUrl)
  const [drafts, setDrafts] = useState(null)
  const generation = useAction()
  const saving = useAction()
  const navigate = useNavigate()
  const saved = useRef(false)
  const hasDrafts = drafts !== null && drafts.length > 0
  useDraftGuard(hasDrafts, saved, saving.pending)

  if (deck.error) return <DeckLoadError error={deck.error} onRetry={deck.reload} />
  if (deck.data === undefined) return <Loading />

  function handleGenerate(form) {
    generation.run(async () => {
      const { cards } = await request(`${deckUrl}/generate`, { method: 'POST', form })
      // The keys keep each editor attached to its card when another is discarded.
      setDrafts(cards.map((card, index) => ({ ...card, key: index })))
    })
  }

  function handleSave() {
    saving.run(async () => {
      const cards = drafts.map(({ front, back }) => ({ front, back }))
      await request(`${deckUrl}/cards/bulk`, { method: 'POST', json: { cards } })
      saved.current = true
      navigate(deckUrl)
    })
  }

  function handleStartOver() {
    if (hasDrafts && !window.confirm(DISCARD_PROMPT)) return
    setDrafts(null)
  }

  return (
    <>
      <BackLink to={deckUrl}>Back to deck</BackLink>
      <PageHeader
        title="Generate cards"
        subtitle={`Claude will write draft cards for ${deck.data.name}.`}
        icon={
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white sm:size-16">
            <SparklesIcon className="size-7 sm:size-8" />
          </span>
        }
      />
      {drafts === null ? (
        <div className={generation.pending ? 'ai-glow rounded-2xl' : undefined}>
          <Panel>
            <SourceForm
              pending={generation.pending}
              error={generation.error}
              onSubmit={handleGenerate}
            />
          </Panel>
        </div>
      ) : (
        <DraftList
          drafts={drafts}
          onChange={setDrafts}
          onStartOver={handleStartOver}
          onSave={handleSave}
          pending={saving.pending}
          error={saving.error}
        />
      )}
    </>
  )
}
