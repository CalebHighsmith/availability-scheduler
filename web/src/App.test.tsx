import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('renders the header', async () => {
    // Avoid unhandled async state updates in AvailabilityPage effects.
    // It fetches staff on mount, so we provide a stable mock.
    globalThis.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ staff: [] }),
        text: async () => '',
      }) as Response) as typeof fetch

    render(<App />)
    expect(screen.getByText('Availability Scheduler')).toBeInTheDocument()
    await screen.findByText('Availability Scheduler')
  })
})

