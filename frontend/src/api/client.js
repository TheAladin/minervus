export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const FALLBACK_MESSAGE = 'Something went wrong. Try again.'

function messageFrom(body) {
  const detail = body?.detail
  if (typeof detail === 'string') return detail
  // Validation errors arrive as a list, each naming its field.
  if (Array.isArray(detail) && detail[0]?.msg) {
    const field = detail[0].loc?.at(-1)
    return typeof field === 'string' ? `${field}: ${detail[0].msg}` : detail[0].msg
  }
  return FALLBACK_MESSAGE
}

async function readJson(response) {
  try {
    return await response.json()
  } catch (error) {
    // Aborting while the body downloads ends up here, and it must stay an abort.
    if (error.name === 'AbortError') throw error
    // A response from a proxy, for example, may not have a JSON body.
    return null
  }
}

/**
 * Calls the API and returns the parsed response.
 * Pass `json` for a JSON body or `form` for a FormData body. Throws ApiError.
 */
export async function request(path, { method = 'GET', json, form, signal } = {}) {
  const init = { method, signal }
  if (json !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(json)
  } else if (form !== undefined) {
    init.body = form
  }

  let response
  try {
    response = await fetch(`/api${path}`, init)
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError(0, "Couldn't reach the server. Check your connection and try again.")
  }

  if (!response.ok) {
    throw new ApiError(response.status, messageFrom(await readJson(response)))
  }
  if (response.status === 204) return null

  const body = await readJson(response)
  if (body === null) throw new ApiError(response.status, FALLBACK_MESSAGE)
  return body
}
