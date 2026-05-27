import { z } from 'zod'
import { parseTimeToMinutes } from './scheduling'

export const StaffCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(100),
})

export const WeeklyWindowCreateSchema = z.object({
  staffId: z.number().int().positive(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string(),
  endTime: z.string(),
})

export const OverrideUpsertSchema = z.object({
  staffId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['unavailable', 'replace', 'add']),
  windows: z
    .array(
      z.object({
        startTime: z.string(),
        endTime: z.string(),
      }),
    )
    .optional(),
})

export function parseWindowTimes(w: { startTime: string; endTime: string }) {
  const startMin = parseTimeToMinutes(w.startTime)
  const endMin = parseTimeToMinutes(w.endTime)
  if (startMin == null || endMin == null) return null
  return { startMin, endMin }
}

