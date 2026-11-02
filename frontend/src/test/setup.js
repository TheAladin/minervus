import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, expect } from 'vitest'

// jsdom doesn't navigate, so a form that forgets preventDefault would pass its tests
// while a real browser reloaded the page. React's handlers run before this listener.
const nativeSubmits = []
document.addEventListener('submit', (event) => {
  if (!event.defaultPrevented) nativeSubmits.push(event.target)
})

afterEach(() => {
  cleanup()
  expect(nativeSubmits.splice(0), 'a form submitted without preventDefault').toEqual([])
})
