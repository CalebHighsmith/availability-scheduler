import { describe, expect, it } from 'vitest'
import {
  compareDateStrings,
  formatMinutesToTime12h,
  generateSlots,
  isValidDateString,
  resolveWindowsForDay,
  validateWindows,
} from '../src/scheduling'

describe('validateWindows', () => {
  it('rejects end before start', () => {
    const r = validateWindows([{ startMin: 600, endMin: 540 }])
    expect(r.ok).toBe(false)
  })

  it('rejects overlapping windows', () => {
    const r = validateWindows([
      { startMin: 540, endMin: 600 },
      { startMin: 590, endMin: 650 },
    ])
    expect(r.ok).toBe(false)
  })
})

describe('resolveWindowsForDay', () => {
  it('unavailable override removes all windows', () => {
    const r = resolveWindowsForDay({
      date: '2026-05-27',
      weekly: [{ startMin: 540, endMin: 600 }],
      override: { type: 'unavailable' },
    })
    expect(r.source).toBe('override_unavailable')
    expect(r.windows).toEqual([])
  })

  it('replace override replaces weekly windows', () => {
    const r = resolveWindowsForDay({
      date: '2026-05-28',
      weekly: [{ startMin: 540, endMin: 600 }],
      override: { type: 'replace', windows: [{ startMin: 600, endMin: 660 }] },
    })
    expect(r.source).toBe('override')
    expect(r.windows).toEqual([{ startMin: 600, endMin: 660 }])
  })

  it('add override adds windows to weekly', () => {
    const r = resolveWindowsForDay({
      date: '2026-05-29',
      weekly: [{ startMin: 540, endMin: 600 }],
      override: { type: 'add', windows: [{ startMin: 1020, endMin: 1140 }] },
    })
    expect(r.source).toBe('override')
    expect(r.windows).toEqual([
      { startMin: 540, endMin: 600 },
      { startMin: 1020, endMin: 1140 },
    ])
  })
})

describe('date helpers', () => {
  it('validates YYYY-MM-DD', () => {
    expect(isValidDateString('2026-05-27')).toBe(true)
    expect(isValidDateString('2026-13-01')).toBe(false)
  })

  it('compares date strings', () => {
    expect(compareDateStrings('2026-05-25', '2026-05-29')).toBe(-1)
    expect(compareDateStrings('2026-05-29', '2026-05-25')).toBe(1)
  })
})

describe('generateSlots', () => {
  it('generates 30-min slots in a 60-min window', () => {
    const slots = generateSlots([{ startMin: 540, endMin: 600 }], 30)
    expect(slots).toEqual([540, 570])
  })

  it('generates 45-min slots in a 60-min window', () => {
    const slots = generateSlots([{ startMin: 540, endMin: 600 }], 45)
    expect(slots).toEqual([540])
  })

  it('formats slot times in 12-hour clock', () => {
    expect(formatMinutesToTime12h(540)).toBe('9:00 AM')
    expect(formatMinutesToTime12h(570)).toBe('9:30 AM')
  })
})

