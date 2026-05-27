import { describe, expect, it } from 'vitest'
import { parseApiError } from './apiError'

describe('parseApiError', () => {
  it('extracts string error from JSON body', () => {
    expect(parseApiError(new Error(JSON.stringify({ error: 'Name is required.' })))).toBe('Name is required.')
  })

  it('falls back for unknown errors', () => {
    expect(parseApiError('nope')).toBe('Something went wrong. Please try again.')
  })
})
