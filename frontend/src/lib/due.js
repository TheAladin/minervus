const DAY_MS = 24 * 60 * 60 * 1000
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function localDay(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

export function isDue(dueAt, now = new Date()) {
  return new Date(dueAt) <= now
}

/** Describes when a card is next due, such as "Due in 6 days". */
export function describeDue(dueAt, now = new Date()) {
  if (isDue(dueAt, now)) return 'Due now'
  const due = new Date(dueAt)
  // Calendar days, so that a card due in two hours reads "today" and not "tomorrow".
  const days = Math.round((localDay(due) - localDay(now)) / DAY_MS)
  if (days < 30) return `Due ${relative.format(days, 'day')}`
  if (days < 365) return `Due ${relative.format(Math.round(days / 30), 'month')}`
  return `Due ${relative.format(Math.round(days / 365), 'year')}`
}
