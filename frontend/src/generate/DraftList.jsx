import { SparklesIcon } from '../components/icons.jsx'
import { Button, EmptyState, ErrorMessage, Field, Textarea } from '../components/ui.jsx'

function DraftEditor({ draft, number, onChange, onDiscard }) {
  return (
    <li
      className="animate-rise rounded-2xl bg-surface p-5 shadow-card dark:shadow-none"
      style={{ animationDelay: `${Math.min(number - 1, 10) * 50}ms` }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-footnote font-semibold text-ink-muted">Card {number}</h3>
        <Button variant="quietDanger" size="sm" className="-mr-2" onClick={onDiscard}>
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
      <EmptyState
        action={
          <Button variant="secondary" onClick={onStartOver}>
            Start over
          </Button>
        }
      >
        You've discarded every card.
      </EmptyState>
    )
  }

  return (
    <>
      <p className="mb-5 flex animate-rise items-start gap-2.5 rounded-2xl bg-ai/10 px-4 py-3 text-subhead">
        <SparklesIcon className="mt-0.5 size-4 shrink-0 text-ai" />
        Nothing is saved yet. Edit or discard these cards, then save the ones you want to keep.
      </p>
      <ul className="space-y-3">
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
      <div className="sticky bottom-4 z-20 mt-6 space-y-3">
        <ErrorMessage>{error}</ErrorMessage>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 rounded-2xl bg-surface/80 py-3 pr-3 pl-5 shadow-raised ring-1 ring-line backdrop-blur-xl backdrop-saturate-150 dark:shadow-none">
          {hasBlankCard && (
            <p className="mr-auto text-footnote font-medium text-warning">
              Fill in or discard the blank cards to save.
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="quiet" disabled={pending} onClick={onStartOver}>
              Start over
            </Button>
            <Button busy={pending} disabled={hasBlankCard} onClick={onSave}>
              Save {drafts.length} {drafts.length === 1 ? 'card' : 'cards'}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
