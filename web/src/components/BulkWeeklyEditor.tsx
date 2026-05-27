import { useState } from 'react'
import { Api } from '../api'
import { parseApiError } from '../lib/apiError'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ')
}

export function BulkWeeklyEditor(props: {
  staffId: number
  disabled: boolean
  onChanged: () => Promise<void>
}) {
  const [days, setDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]))
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  function toggleDay(d: number) {
    setDays((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  function selectWeekdays() {
    setDays(new Set([1, 2, 3, 4, 5]))
  }

  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/80 p-3" data-testid="bulk-weekly-editor">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Bulk weekly editor</div>
      <p className="mt-1 text-xs text-slate-600">Apply the same hours to multiple days at once.</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {DOW.map((label, i) => (
          <button
            key={label}
            type="button"
            data-testid={`bulk-day-${i}`}
            aria-pressed={days.has(i)}
            className={clsx(
              'min-w-[2.5rem] rounded-md border px-2 py-1.5 text-xs font-medium',
              days.has(i) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}
            onClick={() => toggleDay(i)}
          >
            {label}
          </button>
        ))}
      </div>

      <button type="button" className="mt-2 text-xs font-medium text-slate-600 underline" onClick={selectWeekdays}>
        Select Mon–Fri
      </button>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-xs text-slate-600">
          Start
          <input
            className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </label>
        <label className="text-xs text-slate-600">
          End
          <input
            className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </label>
      </div>

      <button
        type="button"
        data-testid="bulk-weekly-apply"
        className={clsx(
          'mt-3 w-full rounded-md px-3 py-2 text-sm font-medium',
          busy || props.disabled || days.size === 0
            ? 'bg-slate-200 text-slate-500'
            : 'bg-slate-900 text-white hover:bg-slate-800',
        )}
        disabled={busy || props.disabled || days.size === 0}
        onClick={async () => {
          setErr(null)
          setMsg(null)
          setBusy(true)
          try {
            const r = await Api.createWeeklyWindowsBulk({
              staffId: props.staffId,
              daysOfWeek: [...days].sort(),
              startTime,
              endTime,
            })
            await props.onChanged()
            const parts = [`Added ${r.created.length} window(s).`]
            if (r.skipped.length) parts.push(`Skipped ${r.skipped.length} duplicate day(s).`)
            setMsg(parts.join(' '))
          } catch (e) {
            setErr(parseApiError(e))
          } finally {
            setBusy(false)
          }
        }}
      >
        Apply to selected days
      </button>

      {err ? <div className="mt-2 text-xs text-red-700">{err}</div> : null}
      {msg ? <div className="mt-2 text-xs text-emerald-800">{msg}</div> : null}
    </div>
  )
}
