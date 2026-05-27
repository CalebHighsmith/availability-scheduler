import { parseApiError } from './lib/apiError'

export type Staff = { id: number; name: string }

export type WeeklyWindow = {
  id: number
  staffId: number
  dayOfWeek: number
  startMin: number
  endMin: number
}

export type OverrideType = 'unavailable' | 'replace' | 'add'

export type Override = {
  id: number
  staffId: number
  date: string
  type: OverrideType
  windows: Array<{ startMin: number; endMin: number }>
}

export type SlotsDay = {
  date: string
  dateLabel: string
  source: 'override_unavailable' | 'override' | 'recurring' | 'none'
  slots: string[]
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    const message = text || `Request failed: ${res.status}`
    throw new Error(parseApiError(new Error(message)))
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const Api = {
  listStaff: () => api<{ staff: Staff[] }>('/staff'),
  createStaff: (name: string) => api<{ staff: Staff }>('/staff', { method: 'POST', body: JSON.stringify({ name }) }),

  listWeeklyWindows: (staffId: number) => api<{ windows: WeeklyWindow[] }>(`/weekly-windows?staffId=${staffId}`),
  createWeeklyWindow: (input: { staffId: number; dayOfWeek: number; startTime: string; endTime: string }) =>
    api<{ window: WeeklyWindow }>('/weekly-windows', { method: 'POST', body: JSON.stringify(input) }),
  deleteWeeklyWindow: (id: number) => api<void>(`/weekly-windows/${id}`, { method: 'DELETE' }),

  listOverrides: (staffId: number) => api<{ overrides: Override[] }>(`/overrides?staffId=${staffId}`),
  upsertOverride: (input: {
    staffId: number
    date: string
    type: OverrideType
    windows?: Array<{ startTime: string; endTime: string }>
  }) => api<{ override: Override }>('/overrides', { method: 'POST', body: JSON.stringify(input) }),
  deleteOverride: (id: number) => api<void>(`/overrides/${id}`, { method: 'DELETE' }),

  getSlots: (q: { staffId: number; start: string; end: string; durationMin: number }) =>
    api<{ days: SlotsDay[] }>(
      `/slots?staffId=${q.staffId}&start=${encodeURIComponent(q.start)}&end=${encodeURIComponent(q.end)}&durationMin=${q.durationMin}`,
    ),
}

