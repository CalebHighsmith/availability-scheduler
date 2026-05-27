export function formatDateLong(date: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return date
  const y = Number(m[1])
  const mo = Number(m[2])
  const da = Number(m[3])
  const d = new Date(y, mo - 1, da)
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da) return date
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export function formatMinutesToTime12h(min: number) {
  const hh24 = Math.floor(min / 60)
  const mm = min % 60
  const am = hh24 < 12
  const hh12 = hh24 % 12 === 0 ? 12 : hh24 % 12
  return `${hh12}:${String(mm).padStart(2, '0')} ${am ? 'AM' : 'PM'}`
}

export function formatTimeRange12h(startMin: number, endMin: number) {
  return `${formatMinutesToTime12h(startMin)}–${formatMinutesToTime12h(endMin)}`
}
