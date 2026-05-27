/** Build YYYY-MM-DD for a calendar cell (may be outside visible month). */
export function toDateString(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function monthStartEnd(year: number, monthIndex: number) {
  const start = toDateString(year, monthIndex, 1)
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  const end = toDateString(year, monthIndex, lastDay)
  return { start, end }
}

/** Sunday-start month grid: 6 rows × 7 cols of { date, inMonth }. */
export function buildMonthGrid(year: number, monthIndex: number) {
  const first = new Date(year, monthIndex, 1)
  const startOffset = first.getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells: Array<{ date: string; inMonth: boolean; day: number }> = []

  for (let i = 0; i < 42; i++) {
    const dayNum = i - startOffset + 1
    if (dayNum < 1) {
      const prevMonth = new Date(year, monthIndex, 0)
      const d = prevMonth.getDate() + dayNum
      const m = monthIndex === 0 ? 11 : monthIndex - 1
      const y = monthIndex === 0 ? year - 1 : year
      cells.push({ date: toDateString(y, m, d), inMonth: false, day: d })
    } else if (dayNum > daysInMonth) {
      const d = dayNum - daysInMonth
      const m = monthIndex === 11 ? 0 : monthIndex + 1
      const y = monthIndex === 11 ? year + 1 : year
      cells.push({ date: toDateString(y, m, d), inMonth: false, day: d })
    } else {
      cells.push({ date: toDateString(year, monthIndex, dayNum), inMonth: true, day: dayNum })
    }
  }
  return cells
}

export function formatMonthYear(year: number, monthIndex: number) {
  return new Date(year, monthIndex, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
