import { useState } from 'react'

import { DocumentIcon, SparklesIcon } from '../components/icons.jsx'
import { Button, ErrorMessage, Field, Input, Textarea } from '../components/ui.jsx'

// These match the limits in the backend, which has the final say.
const MAX_SOURCE_CHARS = 50_000
const MAX_PDF_BYTES = 10 * 1024 * 1024
const MAX_CARDS = 30

const MODES = [
  { value: 'text', label: 'Paste text' },
  { value: 'pdf', label: 'Upload a PDF' },
]

const megabytes = new Intl.NumberFormat('en', { maximumFractionDigits: 1 })

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${megabytes.format(bytes / 1024 / 1024)} MB`
}

/** Two options in a track, with a thumb that slides to the chosen one. */
function ModePicker({ mode, onChange }) {
  const selected = MODES.findIndex(({ value }) => value === mode)
  return (
    <fieldset>
      <legend className="sr-only">Source</legend>
      <div className="relative grid w-full grid-cols-2 rounded-[0.625rem] bg-fill p-0.5 sm:w-80">
        <span
          aria-hidden="true"
          className="absolute inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-lg bg-thumb shadow-thumb transition-transform duration-500 ease-spring"
          style={{ transform: `translateX(${selected * 100}%)` }}
        />
        {MODES.map(({ value, label }) => (
          <label
            key={value}
            className={`relative cursor-pointer rounded-lg px-3 py-1.5 text-center text-footnote transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent ${
              mode === value ? 'font-semibold text-ink' : 'font-medium text-ink-muted hover:text-ink'
            }`}
          >
            <input
              type="radio"
              name="source"
              value={value}
              checked={mode === value}
              onChange={() => onChange(value)}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** Collects the source material. What's entered survives a failed attempt. */
export default function SourceForm({ pending, error, onSubmit }) {
  const [mode, setMode] = useState('text')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [maxCards, setMaxCards] = useState(15)

  // Spreading counts characters the way the backend does, with an emoji as one.
  const textLength = [...text].length
  const textTooLong = textLength > MAX_SOURCE_CHARS
  const fileTooLarge = file !== null && file.size > MAX_PDF_BYTES
  const validCount = Number.isInteger(maxCards) && maxCards >= 1 && maxCards <= MAX_CARDS
  const ready = mode === 'text' ? text.trim() && !textTooLong : file && !fileTooLarge

  function handleModeChange(newMode) {
    setMode(newMode)
    // The file input comes back empty, so a remembered file would be sent unseen.
    setFile(null)
  }

  function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData()
    if (mode === 'text') form.append('text', text)
    else form.append('file', file)
    form.append('max_cards', String(maxCards))
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <ModePicker mode={mode} onChange={handleModeChange} />

      {mode === 'text' ? (
        <div>
          <Field label="Text to learn from">
            <Textarea
              rows={10}
              value={text}
              placeholder="Paste notes, an article or a chapter…"
              aria-invalid={textTooLong}
              onChange={(event) => setText(event.target.value)}
            />
          </Field>
          <p
            className={`mt-1.5 px-1 text-right text-caption tabular-nums ${textTooLong ? 'font-medium text-danger' : 'text-ink-muted'}`}
          >
            {textLength.toLocaleString('en')} of {MAX_SOURCE_CHARS.toLocaleString('en')} characters
          </p>
        </div>
      ) : (
        <div>
          <Field label="PDF file" hint="Up to 10 MB. Scanned PDFs without selectable text won't work.">
            <span
              className={`relative flex flex-col items-center gap-1 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent ${
                fileTooLarge
                  ? 'border-danger/50 bg-danger/5'
                  : 'border-ink-faint/30 hover:border-accent/50 hover:bg-accent/5'
              }`}
            >
              <DocumentIcon className="mb-2 size-9 text-ink-faint" />
              <span aria-hidden="true" className="text-callout font-medium break-all">
                {file ? file.name : 'Choose a PDF'}
              </span>
              <span aria-hidden="true" className="text-footnote text-ink-muted">
                {file ? formatSize(file.size) : 'or drop it here'}
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                aria-invalid={fileTooLarge}
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={(event) => setFile(event.target.files[0] ?? null)}
              />
            </span>
          </Field>
          {fileTooLarge && (
            <p className="mt-1.5 px-1 text-caption font-medium text-danger">
              This file is larger than 10 MB.
            </p>
          )}
        </div>
      )}

      <div className="w-48">
        <Field label="Maximum number of cards" hint={`From 1 to ${MAX_CARDS}.`}>
          <Input
            type="number"
            min={1}
            max={MAX_CARDS}
            required
            className="tabular-nums"
            value={Number.isNaN(maxCards) ? '' : maxCards}
            onChange={(event) => setMaxCards(event.target.valueAsNumber)}
          />
        </Field>
      </div>

      <ErrorMessage>{error}</ErrorMessage>

      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-line pt-5">
        {pending && (
          <p role="status" className="text-footnote text-ink-muted">
            This usually takes under a minute.
          </p>
        )}
        <Button type="submit" variant="ai" busy={pending} disabled={!ready || !validCount}>
          {!pending && <SparklesIcon className="-ml-1 size-4" />}
          {pending ? 'Generating…' : 'Generate cards'}
        </Button>
      </div>
    </form>
  )
}
