import cors from 'cors'
import express from 'express'
import { z } from 'zod'
import { getDb } from './db'
import { sendError, zodErrorMessage } from './errors'
import {
  compareDateStrings,
  datesInclusive,
  dayOfWeek,
  formatDateLong,
  formatMinutesToTime12h,
  generateSlots,
  isValidDateString,
  resolveWindowsForDay,
  validateWindows,
  type Window,
} from './scheduling'
import { OverrideUpsertSchema, StaffCreateSchema, WeeklyWindowCreateSchema, parseWindowTimes } from './validation'

export const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.get('/api/staff', (_req, res) => {
  const db = getDb()
  const staff = db.prepare('select id, name from staff order by id asc').all()
  res.json({ staff })
})

app.post('/api/staff', (req, res) => {
  const parsed = StaffCreateSchema.safeParse(req.body)
  if (!parsed.success) return sendError(res, 400, zodErrorMessage(parsed.error))

  const db = getDb()
  const info = db.prepare('insert into staff (name) values (?)').run(parsed.data.name)
  res.status(201).json({ staff: { id: Number(info.lastInsertRowid), name: parsed.data.name } })
})

app.get('/api/weekly-windows', (req, res) => {
  const staffId = Number(req.query.staffId)
  if (!Number.isInteger(staffId) || staffId <= 0) return sendError(res, 400, 'staffId is required.')
  const db = getDb()
  const windows = db
    .prepare(
      'select id, staff_id as staffId, day_of_week as dayOfWeek, start_min as startMin, end_min as endMin from weekly_windows where staff_id=? order by day_of_week asc, start_min asc',
    )
    .all(staffId)
  res.json({ windows })
})

app.post('/api/weekly-windows', (req, res) => {
  const parsed = WeeklyWindowCreateSchema.safeParse(req.body)
  if (!parsed.success) return sendError(res, 400, zodErrorMessage(parsed.error))

  const startMin = parseWindowTimes({ startTime: parsed.data.startTime, endTime: parsed.data.endTime })
  if (!startMin) return sendError(res, 400, 'Invalid time format. Use HH:MM.')

  const w: Window = startMin
  const validation = validateWindows([w])
  if (!validation.ok) return sendError(res, 400, validation.error)

  const db = getDb()
  const existing = db
    .prepare(
      'select start_min as startMin, end_min as endMin from weekly_windows where staff_id=? and day_of_week=?',
    )
    .all(parsed.data.staffId, parsed.data.dayOfWeek) as Window[]
  const combinedValidation = validateWindows([...existing, w])
  if (!combinedValidation.ok) return sendError(res, 400, combinedValidation.error)

  const info = db
    .prepare('insert into weekly_windows (staff_id, day_of_week, start_min, end_min) values (?,?,?,?)')
    .run(parsed.data.staffId, parsed.data.dayOfWeek, w.startMin, w.endMin)
  res.status(201).json({
    window: {
      id: Number(info.lastInsertRowid),
      staffId: parsed.data.staffId,
      dayOfWeek: parsed.data.dayOfWeek,
      startMin: w.startMin,
      endMin: w.endMin,
    },
  })
})

app.delete('/api/weekly-windows/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) return sendError(res, 400, 'Invalid id.')
  const db = getDb()
  const info = db.prepare('delete from weekly_windows where id=?').run(id)
  if (info.changes === 0) return sendError(res, 404, 'Not found.')
  res.status(204).send()
})

app.get('/api/overrides', (req, res) => {
  const staffId = Number(req.query.staffId)
  if (!Number.isInteger(staffId) || staffId <= 0) return sendError(res, 400, 'staffId is required.')
  const db = getDb()
  const overrides = db
    .prepare('select id, staff_id as staffId, date, type from overrides where staff_id=? order by date asc')
    .all(staffId) as Array<{ id: number; staffId: number; date: string; type: string }>
  const windowsByOverrideId = new Map<number, Window[]>()
  const rows = db
    .prepare(
      'select ow.override_id as overrideId, ow.start_min as startMin, ow.end_min as endMin from override_windows ow join overrides o on o.id = ow.override_id where o.staff_id=?',
    )
    .all(staffId) as Array<{ overrideId: number; startMin: number; endMin: number }>
  for (const r of rows) {
    const arr = windowsByOverrideId.get(r.overrideId) ?? []
    arr.push({ startMin: r.startMin, endMin: r.endMin })
    windowsByOverrideId.set(r.overrideId, arr)
  }
  res.json({
    overrides: overrides.map((o) => ({
      ...o,
      windows: (windowsByOverrideId.get(o.id) ?? []).sort((a, b) => a.startMin - b.startMin),
    })),
  })
})

app.post('/api/overrides', (req, res) => {
  const parsed = OverrideUpsertSchema.safeParse(req.body)
  if (!parsed.success) return sendError(res, 400, zodErrorMessage(parsed.error))

  const { staffId, date, type } = parsed.data
  if (!isValidDateString(date)) return sendError(res, 400, 'Invalid override date. Use YYYY-MM-DD.')

  const windowsInput = parsed.data.windows ?? []
  const windows: Window[] = []
  for (const w of windowsInput) {
    const parsedW = parseWindowTimes(w)
    if (!parsedW) return sendError(res, 400, 'Invalid time format. Use HH:MM.')
    windows.push(parsedW)
  }

  if ((type === 'replace' || type === 'add') && windows.length === 0) {
    return sendError(res, 400, 'Override windows cannot be empty for replace/add.')
  }
  if (type === 'unavailable' && windows.length > 0) {
    return sendError(res, 400, 'Unavailable override cannot have windows.')
  }
  const v = validateWindows(windows)
  if (!v.ok) return sendError(res, 400, v.error)

  const db = getDb()

  if (type === 'add') {
    const dow = dayOfWeek(date)
    if (dow == null) return sendError(res, 400, 'Invalid override date.')
    const weeklyRows = db
      .prepare(
        'select start_min as startMin, end_min as endMin from weekly_windows where staff_id=? and day_of_week=?',
      )
      .all(staffId, dow) as Window[]
    const combined = validateWindows([...weeklyRows, ...windows])
    if (!combined.ok) {
      return sendError(res, 400, 'Add override windows cannot overlap recurring availability for that day.')
    }
  }

  const tx = db.transaction(() => {
    const existing = db.prepare('select id from overrides where staff_id=? and date=?').get(staffId, date) as
      | { id: number }
      | undefined
    let overrideId: number
    if (existing) {
      overrideId = existing.id
      db.prepare('update overrides set type=? where id=?').run(type, overrideId)
      db.prepare('delete from override_windows where override_id=?').run(overrideId)
    } else {
      const info = db.prepare('insert into overrides (staff_id, date, type) values (?,?,?)').run(staffId, date, type)
      overrideId = Number(info.lastInsertRowid)
    }
    for (const w of windows) {
      db.prepare('insert into override_windows (override_id, start_min, end_min) values (?,?,?)').run(
        overrideId,
        w.startMin,
        w.endMin,
      )
    }
    return overrideId
  })

  const overrideId = tx()
  res.status(201).json({ override: { id: overrideId, staffId, date, type, windows } })
})

app.delete('/api/overrides/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) return sendError(res, 400, 'Invalid id.')
  const db = getDb()
  const info = db.prepare('delete from overrides where id=?').run(id)
  if (info.changes === 0) return sendError(res, 404, 'Not found.')
  res.status(204).send()
})

app.get('/api/slots', (req, res) => {
  const q = z
    .object({
      staffId: z.coerce.number().int().positive(),
      start: z.string(),
      end: z.string(),
      durationMin: z.coerce.number().int().positive(),
    })
    .safeParse(req.query)
  if (!q.success) return sendError(res, 400, zodErrorMessage(q.error))

  const { staffId, start, end, durationMin } = q.data

  if (!isValidDateString(start) || !isValidDateString(end)) {
    return sendError(res, 400, 'Invalid date. Use YYYY-MM-DD.')
  }
  const rangeCmp = compareDateStrings(start, end)
  if (rangeCmp === null) return sendError(res, 400, 'Invalid date. Use YYYY-MM-DD.')
  if (rangeCmp > 0) return sendError(res, 400, 'Start date must be on or before end date.')

  const db = getDb()
  const weekly = db
    .prepare(
      'select day_of_week as dayOfWeek, start_min as startMin, end_min as endMin from weekly_windows where staff_id=? order by day_of_week asc, start_min asc',
    )
    .all(staffId) as Array<{ dayOfWeek: number; startMin: number; endMin: number }>
  const byDow = new Map<number, Window[]>()
  for (const r of weekly) {
    const arr = byDow.get(r.dayOfWeek) ?? []
    arr.push({ startMin: r.startMin, endMin: r.endMin })
    byDow.set(r.dayOfWeek, arr)
  }

  const overrides = db
    .prepare('select id, date, type from overrides where staff_id=? and date between ? and ?')
    .all(staffId, start, end) as Array<{ id: number; date: string; type: string }>
  const overridesByDate = new Map<string, { id: number; type: string }>()
  for (const o of overrides) overridesByDate.set(o.date, o)
  const overrideWindows = db
    .prepare(
      'select o.date as date, ow.start_min as startMin, ow.end_min as endMin from override_windows ow join overrides o on o.id=ow.override_id where o.staff_id=? and o.date between ? and ?',
    )
    .all(staffId, start, end) as Array<{ date: string; startMin: number; endMin: number }>
  const windowsByDate = new Map<string, Window[]>()
  for (const w of overrideWindows) {
    const arr = windowsByDate.get(w.date) ?? []
    arr.push({ startMin: w.startMin, endMin: w.endMin })
    windowsByDate.set(w.date, arr)
  }

  const days = []
  for (const date of datesInclusive(start, end)) {
    const dow = dayOfWeek(date)
    const weeklyWindows = dow == null ? [] : (byDow.get(dow) ?? [])
    const ov = overridesByDate.get(date)
    const resolved = resolveWindowsForDay({
      date,
      weekly: weeklyWindows,
      override: ov
        ? ov.type === 'unavailable'
          ? { type: 'unavailable' }
          : ov.type === 'replace'
            ? { type: 'replace', windows: windowsByDate.get(date) ?? [] }
            : { type: 'add', windows: windowsByDate.get(date) ?? [] }
        : null,
    })
    const slotStarts = generateSlots(resolved.windows, durationMin)
    days.push({
      date,
      dateLabel: formatDateLong(date),
      source: resolved.source,
      slots: slotStarts.map(formatMinutesToTime12h),
    })
  }
  res.json({ days })
})
