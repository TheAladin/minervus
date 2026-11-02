// Stands in for the Anthropic API in browser tests, so they cost nothing and need no key.
// The backend's real SDK talks to this over HTTP. It rejects requests the real API would
// reject, and words in the source can trigger failures.
import { createServer } from 'node:http'

const port = Number(process.argv[2])

function respond(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

function apiError(response, status, type, message) {
  respond(response, status, { type: 'error', error: { type, message } })
}

function message(content, stopReason = 'end_turn') {
  return {
    id: 'msg_fake',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    content,
    stop_reason: stopReason,
    stop_details: null,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  }
}

function handleMessages(request, response, body) {
  const { authorization, 'x-api-key': apiKey } = request.headers
  if (authorization !== 'Bearer e2e-key' && apiKey !== 'e2e-key') {
    return apiError(response, 401, 'authentication_error', 'invalid credentials')
  }
  const format = body.output_config?.format
  if (!body.model?.startsWith('claude-') || !body.max_tokens || format?.type !== 'json_schema') {
    return apiError(response, 400, 'invalid_request_error', 'unexpected request shape')
  }

  const prompt = body.messages[0].content
  const source = prompt.match(/<source>\n([\s\S]*)\n<\/source>/)[1]
  if (source.includes('TRIGGER_RATE_LIMIT')) {
    return apiError(response, 429, 'rate_limit_error', 'slow down')
  }
  if (source.includes('TRIGGER_REFUSAL')) return respond(response, 200, message([], 'refusal'))

  const limit = Number(prompt.match(/at most (\d+) flashcards/)[1])
  const cards = [
    { front: 'What does the source say?', back: source.slice(0, 80) },
    { front: 'What is the second card about?', back: 'It tests editing a draft.' },
    { front: 'What is the third card about?', back: 'It tests discarding a draft.' },
  ].slice(0, limit)
  respond(
    response,
    200,
    message([
      { type: 'thinking', thinking: '', signature: 'fake' },
      { type: 'text', text: JSON.stringify({ cards }) },
    ]),
  )
}

createServer((request, response) => {
  if (request.url === '/health') return respond(response, 200, { status: 'ok' })
  if (request.method !== 'POST' || request.url !== '/v1/messages') {
    return apiError(response, 404, 'not_found_error', 'not found')
  }
  let raw = ''
  request.on('data', (chunk) => {
    raw += chunk
  })
  request.on('end', () => handleMessages(request, response, JSON.parse(raw)))
}).listen(port, '127.0.0.1')
