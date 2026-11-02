const DAY_MS = 24 * 60 * 60 * 1000
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function localDay(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Describes when a card is next due, such as "Due in 6 days". */
export function describeDue(dueAt, now = new Date()) {
  const due = new Date(dueAt)
  if (due <= now) return 'Due now'
  // Calendar days, so that a card due in two hours reads "today" and not "tomorrow".
  const days = Math.round((localDay(due) - localDay(now)) / DAY_MS)
  if (days < 30) return `Due ${relative.format(days, 'day')}`
  if (days < 365) return `Due ${relative.format(Math.round(days / 30), 'month')}`
  return `Due ${relative.format(Math.round(days / 365), 'year')}`
}
