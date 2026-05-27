export function parseApiError(err: unknown): string {
  if (!(err instanceof Error)) return 'Something went wrong. Please try again.'
  const raw = err.message.trim()
  if (!raw) return 'Something went wrong. Please try again.'

  try {
    const parsed = JSON.parse(raw) as { error?: unknown }
    if (typeof parsed.error === 'string') return parsed.error
    if (parsed.error && typeof parsed.error === 'object') {
      const flat = parsed.error as {
        formErrors?: string[]
        fieldErrors?: Record<string, string[]>
      }
      const parts: string[] = []
      if (flat.formErrors?.length) parts.push(...flat.formErrors)
      if (flat.fieldErrors) {
        for (const [field, messages] of Object.entries(flat.fieldErrors)) {
          for (const msg of messages ?? []) parts.push(`${field}: ${msg}`)
        }
      }
      if (parts.length) return parts.join(' ')
    }
  } catch {
    // not JSON — fall through
  }

  if (raw.startsWith('Request failed:')) return 'Something went wrong. Please try again.'
  return raw
}
