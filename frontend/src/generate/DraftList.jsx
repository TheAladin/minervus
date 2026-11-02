import { Button, ErrorMessage, Field, Textarea } from '../components/ui.jsx'

function DraftEditor({ draft, number, onChange, onDiscard }) {
  return (
    <li className="p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-stone-700">Card {number}</h3>
        <Button variant="quiet" onClick={onDiscard}>
          Discard
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Front">
          <Textarea
            rows={3}
            maxLength={10_000}
            value={draft.front}
            onChange={(event) => onChange({ ...draft, front: event.target.value })}
          />
        </Field>
        <Field label="Back">
          <Textarea
            rows={3}
            maxLength={10_000}
            value={draft.back}
            onChange={(event) => onChange({ ...draft, back: event.target.value })}
          />
        </Field>
      </div>
    </li>
  )
}

/** Lets the user correct or discard generated cards before anything is saved. */
export default function DraftList({ drafts, onChange, onStartOver, onSave, pending, error }) {
  const hasBlankCard = drafts.some(({ front, back }) => !front.trim() || !back.trim())

  function replace(updated) {
    onChange(drafts.map((draft) => (draft.key === updated.key ? updated : draft)))
  }

  function discard(key) {
    onChange(drafts.filter((draft) => draft.key !== key))
  }

  if (drafts.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-stone-500">You've discarded every card.</p>
        <Button variant="secondary" onClick={onStartOver}>
          Start over
        </Button>
      </div>
    )
  }

  return (
    <>
      <p className="mb-4 text-sm text-stone-600">
        Nothing is saved yet. Edit or discard these cards, then save the ones you want to keep.
      </p>
      <ul className="mb-4 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
        {drafts.map((draft, index) => (
          <DraftEditor
            key={draft.key}
            draft={draft}
            number={index + 1}
            onChange={replace}
            onDiscard={() => discard(draft.key)}
          />
        ))}
      </ul>
      <div className="space-y-3">
        <ErrorMessage>{error}</ErrorMessage>
        {hasBlankCard && (
          <p className="text-sm text-stone-500">Fill in or discard the blank cards to save.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending || hasBlankCard} onClick={onSave}>
            Save {drafts.length} {drafts.length === 1 ? 'card' : 'cards'}
          </Button>
          <Button variant="quiet" disabled={pending} onClick={onStartOver}>
            Start over
          </Button>
        </div>
      </div>
    </>
  )
}
