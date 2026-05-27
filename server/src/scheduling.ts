export type Window = { startMin: number; endMin: number }

export type OverrideType = 'unavailable' | 'replace' | 'add'

export type ResolvedDay =
  | { date: string; source: 'override_unavailable'; windows: [] }
  | { date: string; source: 'override'; windows: Window[] }
  | { date: string; source: 'recurring'; windows: Window[] }
  | { date: string; source: 'none'; windows: [] }

export function parseTimeToMinutes(hhmm: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null
  if (hh < 0 || hh > 23) return null
  if (mm < 0 || mm > 59) return null
  return hh * 60 + mm
}

export function formatMinutesToTime(min: number) {
  const hh = Math.floor(min / 60)
  const mm = min % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function validateWindows(windows: Window[]) {
  for (const w of windows) {
    if (!Number.isInteger(w.startMin) || !Number.isInteger(w.endMin)) {
      return { ok: false as const, error: 'Times must be whole minutes.' }
    }
    if (w.startMin < 0 || w.startMin > 24 * 60) {
      return { ok: false as const, error: 'Start time out of range.' }
    }
    if (w.endMin < 0 || w.endMin > 24 * 60) {
      return { ok: false as const, error: 'End time out of range.' }
    }
    if (w.endMin <= w.startMin) {
      return { ok: false as const, error: 'End time must be after start time.' }
    }
  }

  const sorted = [...windows].sort((a, b) => a.startMin - b.startMin)
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const cur = sorted[i]
    if (cur.startMin < prev.endMin) {
      return { ok: false as const, error: 'Availability windows cannot overlap.' }
    }
  }
  return { ok: true as const }
}

export function* datesInclusive(startDate: string, endDate: string) {
  const start = parseDate(startDate)
  const end = parseDate(endDate)
  if (!start || !end) return
  if (start.getTime() > end.getTime()) return
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
    yield formatDate(d)
  }
}

export function dayOfWeek(date: string) {
  const d = parseDate(date)
  if (!d) return null
  return d.getDay() // 0 Sun..6 Sat
}

export function isValidDateString(date: string) {
  return parseDate(date) !== null
}

export function compareDateStrings(a: string, b: string) {
  const da = parseDate(a)
  const db = parseDate(b)
  if (!da || !db) return null
  return Math.sign(da.getTime() - db.getTime())
}

export function formatMinutesToTime12h(min: number) {
  const hh24 = Math.floor(min / 60)
  const mm = min % 60
  const am = hh24 < 12
  const hh12 = hh24 % 12 === 0 ? 12 : hh24 % 12
  return `${hh12}:${String(mm).padStart(2, '0')} ${am ? 'AM' : 'PM'}`
}

export function formatDateLong(date: string) {
  const d = parseDate(date)
  if (!d) return date
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function parseDate(date: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const da = Number(m[3])
  const d = new Date(y, mo - 1, da)
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da) return null
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

export function resolveWindowsForDay(args: {
  date: string
  weekly: Window[]
  override:
    | null
    | { type: 'unavailable' }
    | { type: 'replace'; windows: Window[] }
    | { type: 'add'; windows: Window[] }
}) : ResolvedDay {
  const { date, weekly, override } = args
  if (override?.type === 'unavailable') {
    return { date, source: 'override_unavailable', windows: [] }
  }
  if (override?.type === 'replace') {
    return override.windows.length
      ? { date, source: 'override', windows: override.windows }
      : { date, source: 'override', windows: [] }
  }
  if (override?.type === 'add') {
    const combined = mergeSortedWindows([...weekly, ...override.windows])
    return combined.length ? { date, source: 'override', windows: combined } : { date, source: 'none', windows: [] }
  }
  if (weekly.length) return { date, source: 'recurring', windows: weekly }
  return { date, source: 'none', windows: [] }
}

function mergeSortedWindows(windows: Window[]) {
  if (!windows.length) return []
  const sorted = [...windows].sort((a, b) => a.startMin - b.startMin)
  const out: Window[] = []
  for (const w of sorted) {
    const last = out[out.length - 1]
    if (!last) out.push({ ...w })
    else if (w.startMin > last.endMin) out.push({ ...w })
    else {
      // overlapping/adjacent: merge to prevent duplicates in slot generation
      last.endMin = Math.max(last.endMin, w.endMin)
    }
  }
  return out
}

export function generateSlots(windows: Window[], durationMin: number) {
  if (!Number.isInteger(durationMin) || durationMin <= 0) return []
  const starts: number[] = []
  for (const w of windows) {
    for (let t = w.startMin; t + durationMin <= w.endMin; t += durationMin) {
      starts.push(t)
    }
  }
  return starts
}

