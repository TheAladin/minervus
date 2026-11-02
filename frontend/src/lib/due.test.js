import { expect, test } from 'vitest'

import { describeDue } from './due.js'

// June 15, at noon local time.
const NOW = new Date(2026, 5, 15, 12)

function at(month, day, hour = 12, year = 2026) {
  return new Date(year, month, day, hour).toISOString()
}

test.each([
  ['in the past', at(5, 12), 'Due now'],
  ['right now', NOW.toISOString(), 'Due now'],
  ['later today', at(5, 15, 14), 'Due today'],
  ['just after midnight', at(5, 16, 0), 'Due tomorrow'],
  ['exactly a day away', at(5, 16), 'Due tomorrow'],
  ['in six days', at(5, 21), 'Due in 6 days'],
  ['in 29 days', at(6, 14), 'Due in 29 days'],
  ['in 30 days', at(6, 15), 'Due next month'],
  ['in about three months', at(8, 13), 'Due in 3 months'],
  ['in 364 days', at(5, 14, 12, 2027), 'Due in 12 months'],
  ['in a year', at(5, 15, 12, 2027), 'Due next year'],
  ['in three years', at(5, 14, 12, 2029), 'Due in 3 years'],
])('%s', (_, dueAt, expected) => {
  expect(describeDue(dueAt, NOW)).toBe(expected)
})
