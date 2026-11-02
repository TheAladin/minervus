import { useState } from 'react'

import { Button, ErrorMessage, Field, Input, Textarea } from '../components/ui.jsx'

// These match the limits in the backend, which has the final say.
const MAX_SOURCE_CHARS = 50_000
const MAX_PDF_BYTES = 10 * 1024 * 1024
const MAX_CARDS = 30

const MODES = [
  { value: 'text', label: 'Paste text' },
  { value: 'pdf', label: 'Upload a PDF' },
]

function ModePicker({ mode, onChange }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-stone-700">Source</legend>
      <div className="inline-flex rounded-md border border-stone-300 bg-white p-0.5">
        {MODES.map(({ value, label }) => (
          <label
            key={value}
            className={`cursor-pointer rounded px-3 py-1.5 text-sm font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-stone-900 ${
              mode === value ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <ModePicker mode={mode} onChange={handleModeChange} />

      {mode === 'text' ? (
        <div>
          <Field label="Text to learn from">
            <Textarea
              rows={10}
              value={text}
              aria-invalid={textTooLong}
              onChange={(event) => setText(event.target.value)}
            />
          </Field>
          <p className={`mt-1 text-xs ${textTooLong ? 'font-medium text-red-700' : 'text-stone-500'}`}>
            {textLength.toLocaleString('en')} of {MAX_SOURCE_CHARS.toLocaleString('en')} characters
          </p>
        </div>
      ) : (
        <div>
          <Field label="PDF file" hint="Up to 10 MB. Scanned PDFs without selectable text won't work.">
            <Input
              type="file"
              accept="application/pdf,.pdf"
              aria-invalid={fileTooLarge}
              className="file:mr-3 file:rounded file:border-0 file:bg-stone-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-stone-800"
              onChange={(event) => setFile(event.target.files[0] ?? null)}
            />
          </Field>
          {fileTooLarge && (
            <p className="mt-1 text-xs font-medium text-red-700">This file is larger than 10 MB.</p>
          )}
        </div>
      )}

      <div className="max-w-48">
        <Field label="Maximum number of cards" hint={`From 1 to ${MAX_CARDS}.`}>
          <Input
            type="number"
            min={1}
            max={MAX_CARDS}
            required
            value={Number.isNaN(maxCards) ? '' : maxCards}
            onChange={(event) => setMaxCards(event.target.valueAsNumber)}
          />
        </Field>
      </div>

      <ErrorMessage>{error}</ErrorMessage>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !ready || !validCount}>
          {pending ? 'Generating…' : 'Generate cards'}
        </Button>
        {pending && (
          <p role="status" className="text-sm text-stone-500">
            This usually takes under a minute.
          </p>
        )}
      </div>
    </form>
  )
}
