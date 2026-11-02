import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import { apiError, mockApi, signedIn } from '../test/api.js'
import { renderApp } from '../test/render.jsx'

const DECK = { id: 7, name: 'Biology', card_count: 0, due_count: 0 }
const DRAFTS = {
  cards: [
    { front: 'What do mitochondria make?', back: 'ATP' },
    { front: 'What do ribosomes make?', back: 'Proteins' },
  ],
}

function routes(overrides = {}) {
  return {
    ...signedIn,
    'GET /decks/7': DECK,
    'GET /decks/7/cards': [],
    'POST /decks/7/generate': DRAFTS,
    'POST /decks/7/cards/bulk': [],
    ...overrides,
  }
}

const currentPath = () => screen.getByTestId('location').textContent
const generateButton = () => screen.findByRole('button', { name: 'Generate cards' })

async function generateFromText(user, text = 'Cells have organelles.') {
  await user.type(await screen.findByLabelText('Text to learn from'), text)
  await user.click(screen.getByRole('button', { name: 'Generate cards' }))
}

test('sends pasted text and the card limit as a form', async () => {
  const calls = mockApi(routes())
  const user = renderApp('/decks/7/generate')
  await screen.findByLabelText('Text to learn from')
  const limit = screen.getByLabelText(/^Maximum number of cards/)
  await user.clear(limit)
  await user.type(limit, '20')

  await generateFromText(user)

  await screen.findAllByRole('listitem')
  const { body } = calls.find((call) => call.path === '/decks/7/generate')
  expect(body.get('text')).toBe('Cells have organelles.')
  expect(body.get('max_cards')).toBe('20')
  expect(body.has('file')).toBe(false)
})

test('sends an uploaded PDF', async () => {
  const calls = mockApi(routes())
  const user = renderApp('/decks/7/generate')
  const file = new File(['%PDF-1.4'], 'notes.pdf', { type: 'application/pdf' })

  await user.click(await screen.findByRole('radio', { name: 'Upload a PDF' }))
  await user.upload(screen.getByLabelText(/^PDF file/), file)
  await user.click(screen.getByRole('button', { name: 'Generate cards' }))

  await screen.findAllByRole('listitem')
  const { body } = calls.find((call) => call.path === '/decks/7/generate')
  expect(body.get('file').name).toBe('notes.pdf')
  expect(body.has('text')).toBe(false)
})

test('generating needs a source and a valid card limit', async () => {
  mockApi(routes())
  const user = renderApp('/decks/7/generate')
  const button = await generateButton()

  expect(button).toBeDisabled()

  await user.type(screen.getByLabelText('Text to learn from'), '   ')
  expect(button).toBeDisabled()

  await user.type(screen.getByLabelText('Text to learn from'), 'Cells')
  expect(button).toBeEnabled()

  const limit = screen.getByLabelText(/^Maximum number of cards/)
  for (const invalid of ['0', '31', '']) {
    await user.clear(limit)
    if (invalid) await user.type(limit, invalid)
    expect(button).toBeDisabled()
  }
})

test('text over the limit says so and cannot be sent', async () => {
  mockApi(routes())
  renderApp('/decks/7/generate')
  const input = await screen.findByLabelText('Text to learn from')

  fireEvent.change(input, { target: { value: 'x'.repeat(50_000) } })
  expect(screen.getByText('50,000 of 50,000 characters')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Generate cards' })).toBeEnabled()

  fireEvent.change(input, { target: { value: 'x'.repeat(50_001) } })
  expect(screen.getByText('50,001 of 50,000 characters')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Generate cards' })).toBeDisabled()
})

test('a PDF over 10 MB says so and cannot be sent', async () => {
  mockApi(routes())
  const user = renderApp('/decks/7/generate')
  const file = new File(['x'], 'big.pdf', { type: 'application/pdf' })
  Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 + 1 })

  await user.click(await screen.findByRole('radio', { name: 'Upload a PDF' }))
  await user.upload(screen.getByLabelText(/^PDF file/), file)

  expect(screen.getByText('This file is larger than 10 MB.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Generate cards' })).toBeDisabled()
})

test('counts an emoji as one character, like the backend does', async () => {
  mockApi(routes())
  renderApp('/decks/7/generate')
  const input = await screen.findByLabelText('Text to learn from')

  fireEvent.change(input, { target: { value: '😀'.repeat(50_000) } })

  expect(screen.getByText('50,000 of 50,000 characters')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Generate cards' })).toBeEnabled()
})

test('switching away and back forgets the chosen file, so it cannot be sent unseen', async () => {
  mockApi(routes())
  const user = renderApp('/decks/7/generate')
  const file = new File(['%PDF-1.4'], 'notes.pdf', { type: 'application/pdf' })
  await user.click(await screen.findByRole('radio', { name: 'Upload a PDF' }))
  await user.upload(screen.getByLabelText(/^PDF file/), file)
  expect(screen.getByRole('button', { name: 'Generate cards' })).toBeEnabled()

  await user.click(screen.getByRole('radio', { name: 'Paste text' }))
  await user.click(screen.getByRole('radio', { name: 'Upload a PDF' }))

  expect(screen.getByLabelText(/^PDF file/).files).toHaveLength(0)
  expect(screen.getByRole('button', { name: 'Generate cards' })).toBeDisabled()
})

test('shows progress while generating and blocks a second request', async () => {
  let finish
  const calls = mockApi(
    routes({
      'POST /decks/7/generate': () =>
        new Promise((resolve) => {
          finish = () => resolve(DRAFTS)
        }),
    }),
  )
  const user = renderApp('/decks/7/generate')

  await generateFromText(user)

  expect(screen.getByRole('button', { name: 'Generating…' })).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('under a minute')
  await waitFor(() => expect(finish).toBeDefined())
  finish()
  await screen.findAllByRole('listitem')
  expect(calls.filter((call) => call.path === '/decks/7/generate')).toHaveLength(1)
})

test('a failed generation shows the error and keeps the text', async () => {
  mockApi(
    routes({
      'POST /decks/7/generate': apiError(503, 'The AI service is busy. Try again in a moment.'),
    }),
  )
  const user = renderApp('/decks/7/generate')

  await generateFromText(user, 'Keep this text')

  expect(await screen.findByRole('alert')).toHaveTextContent('The AI service is busy')
  expect(screen.getByLabelText('Text to learn from')).toHaveValue('Keep this text')
  expect(await generateButton()).toBeEnabled()
})

test('shows the generated cards for review without saving them', async () => {
  const calls = mockApi(routes())
  const user = renderApp('/decks/7/generate')

  await generateFromText(user)

  const [first, second] = await screen.findAllByRole('listitem')
  expect(within(first).getByLabelText('Front')).toHaveValue('What do mitochondria make?')
  expect(within(first).getByLabelText('Back')).toHaveValue('ATP')
  expect(within(second).getByLabelText('Back')).toHaveValue('Proteins')
  expect(screen.getByText(/Nothing is saved yet/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save 2 cards' })).toBeEnabled()
  expect(calls.some((call) => call.path.endsWith('/bulk'))).toBe(false)
})

test('saves edited drafts without the discarded ones, then opens the deck', async () => {
  const calls = mockApi(routes())
  const user = renderApp('/decks/7/generate')
  await generateFromText(user)
  const [first, second] = await screen.findAllByRole('listitem')

  const back = within(second).getByLabelText('Back')
  await user.clear(back)
  await user.type(back, 'Polypeptides')
  await user.click(within(first).getByRole('button', { name: 'Discard' }))
  await user.click(screen.getByRole('button', { name: 'Save 1 card' }))

  await waitFor(() => expect(currentPath()).toBe('/decks/7'))
  expect(calls.find((call) => call.path.endsWith('/bulk')).body).toEqual({
    cards: [{ front: 'What do ribosomes make?', back: 'Polypeptides' }],
  })
})

test('discarding a card keeps edits in the other cards', async () => {
  mockApi(routes())
  const user = renderApp('/decks/7/generate')
  await generateFromText(user)
  const [first, second] = await screen.findAllByRole('listitem')

  await user.type(within(second).getByLabelText('Back'), ' and more')
  await user.click(within(first).getByRole('button', { name: 'Discard' }))

  const [remaining] = screen.getAllByRole('listitem')
  expect(within(remaining).getByLabelText('Back')).toHaveValue('Proteins and more')
  expect(within(remaining).getByRole('heading', { name: 'Card 1' })).toBeInTheDocument()
})

test('blank drafts block saving until fixed or discarded', async () => {
  mockApi(routes())
  const user = renderApp('/decks/7/generate')
  await generateFromText(user)
  const [first] = await screen.findAllByRole('listitem')

  await user.clear(within(first).getByLabelText('Back'))

  expect(screen.getByRole('button', { name: 'Save 2 cards' })).toBeDisabled()
  expect(screen.getByText(/blank cards/)).toBeInTheDocument()

  await user.click(within(first).getByRole('button', { name: 'Discard' }))

  expect(screen.getByRole('button', { name: 'Save 1 card' })).toBeEnabled()
})

test('a failed save keeps the drafts and shows the error', async () => {
  mockApi(routes({ 'POST /decks/7/cards/bulk': apiError(500, 'Server error') }))
  const user = renderApp('/decks/7/generate')
  await generateFromText(user)
  await screen.findAllByRole('listitem')

  await user.click(screen.getByRole('button', { name: 'Save 2 cards' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Server error')
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  expect(currentPath()).toBe('/decks/7/generate')
})

test('discarding everything offers a fresh start', async () => {
  mockApi(routes())
  const user = renderApp('/decks/7/generate')
  await generateFromText(user)

  for (const button of await screen.findAllByRole('button', { name: 'Discard' })) {
    await user.click(button)
  }

  // With nothing left to lose, starting over doesn't need a prompt.
  expect(screen.getByText("You've discarded every card.")).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Save/ })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Start over' }))

  expect(await generateButton()).toBeInTheDocument()
})

test('leaving with unsaved drafts asks first', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  mockApi(routes())
  const user = renderApp('/decks/7/generate')
  await generateFromText(user)
  await screen.findAllByRole('listitem')

  await user.click(screen.getByRole('link', { name: '← Back to deck' }))

  await waitFor(() => expect(confirm).toHaveBeenCalledOnce())
  expect(confirm.mock.calls[0][0]).toContain("haven't been saved")
  expect(currentPath()).toBe('/decks/7/generate')
  expect(screen.getAllByRole('listitem')).toHaveLength(2)

  confirm.mockReturnValue(true)
  await user.click(screen.getByRole('link', { name: '← Back to deck' }))

  await waitFor(() => expect(currentPath()).toBe('/decks/7'))
})

test('leaving before generating anything does not ask', async () => {
  const confirm = vi.spyOn(window, 'confirm')
  mockApi(routes())
  const user = renderApp('/decks/7/generate')

  await user.click(await screen.findByRole('link', { name: '← Back to deck' }))

  await waitFor(() => expect(currentPath()).toBe('/decks/7'))
  expect(confirm).not.toHaveBeenCalled()
})

test('saving leaves without asking', async () => {
  const confirm = vi.spyOn(window, 'confirm')
  mockApi(routes())
  const user = renderApp('/decks/7/generate')
  await generateFromText(user)
  await screen.findAllByRole('listitem')

  await user.click(screen.getByRole('button', { name: 'Save 2 cards' }))

  await waitFor(() => expect(currentPath()).toBe('/decks/7'))
  expect(confirm).not.toHaveBeenCalled()
})

test('leaving during a save stays put without asking, then the save moves on', async () => {
  const confirm = vi.spyOn(window, 'confirm')
  let finish
  mockApi(
    routes({
      'POST /decks/7/cards/bulk': () =>
        new Promise((resolve) => {
          finish = () => resolve([])
        }),
    }),
  )
  const user = renderApp('/decks/7/generate')
  await generateFromText(user)
  await screen.findAllByRole('listitem')
  await user.click(screen.getByRole('button', { name: 'Save 2 cards' }))

  await user.click(screen.getByRole('link', { name: '← Back to deck' }))

  expect(confirm).not.toHaveBeenCalled()
  expect(currentPath()).toBe('/decks/7/generate')

  await waitFor(() => expect(finish).toBeDefined())
  finish()

  await waitFor(() => expect(currentPath()).toBe('/decks/7'))
  expect(confirm).not.toHaveBeenCalled()
})

test('start over asks first while there are drafts', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  mockApi(routes())
  const user = renderApp('/decks/7/generate')
  await generateFromText(user)
  await screen.findAllByRole('listitem')

  await user.click(screen.getByRole('button', { name: 'Start over' }))

  expect(screen.getAllByRole('listitem')).toHaveLength(2)

  confirm.mockReturnValue(true)
  await user.click(screen.getByRole('button', { name: 'Start over' }))

  expect(await generateButton()).toBeInTheDocument()
})

test('reloading with drafts triggers the browser warning, and only then', async () => {
  mockApi(routes())
  const user = renderApp('/decks/7/generate')
  const reload = () => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }
  await screen.findByLabelText('Text to learn from')
  expect(reload()).toBe(false)

  await generateFromText(user)
  await screen.findAllByRole('listitem')

  expect(reload()).toBe(true)
})

test('shows not found for a deck that is not there', async () => {
  mockApi({ ...signedIn, 'GET /decks/7': apiError(404, 'Deck not found') })

  renderApp('/decks/7/generate')

  expect(await screen.findByRole('heading', { name: 'Deck not found' })).toBeInTheDocument()
})
