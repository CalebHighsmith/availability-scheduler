import { useMemo } from 'react'
import type { SlotsDay } from '../api'
import { buildMonthGrid, formatMonthYear } from '../lib/calendar'
import { formatDateLong } from '../lib/format'

function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ')
}

const SOURCE_STYLES: Record<SlotsDay['source'], string> = {
  recurring: 'bg-emerald-100 border-emerald-300 text-emerald-900',
  override: 'bg-indigo-100 border-indigo-300 text-indigo-900',
  override_unavailable: 'bg-amber-100 border-amber-300 text-amber-900',
  none: 'bg-slate-50 border-slate-200 text-slate-400',
}

export function AvailabilityCalendar(props: {
  year: number
  monthIndex: number
  days: SlotsDay[] | null
  selectedDate: string | null
  onSelectDate: (date: string) => void
  onPrevMonth: () => void
  onNextMonth: () => void
}) {
  const byDate = useMemo(() => {
    const m = new Map<string, SlotsDay>()
    for (const d of props.days ?? []) m.set(d.date, d)
    return m
  }, [props.days])

  const cells = useMemo(() => buildMonthGrid(props.year, props.monthIndex), [props.year, props.monthIndex])
  const selected = props.selectedDate ? byDate.get(props.selectedDate) : null

  return (
    <div data-testid="availability-calendar" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="rounded-md border px-2 py-1 text-sm hover:bg-slate-50"
          aria-label="Previous month"
          onClick={props.onPrevMonth}
        >
          ←
        </button>
        <div className="text-sm font-semibold">{formatMonthYear(props.year, props.monthIndex)}</div>
        <button
          type="button"
          className="rounded-md border px-2 py-1 text-sm hover:bg-slate-50"
          aria-label="Next month"
          onClick={props.onNextMonth}
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase text-slate-500 sm:text-xs">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const dayData = byDate.get(cell.date)
          const source = dayData?.source ?? (props.days ? 'none' : undefined)
          const isSelected = props.selectedDate === cell.date
          const slotCount = dayData?.slots.length ?? 0

          return (
            <button
              key={cell.date}
              type="button"
              data-testid={`calendar-day-${cell.date}`}
              aria-label={cell.date}
              className={clsx(
                'flex min-h-[2.75rem] flex-col items-center justify-center rounded-md border p-0.5 text-xs transition sm:min-h-[3.25rem]',
                !cell.inMonth && 'opacity-40',
                source ? SOURCE_STYLES[source] : 'border-slate-200 bg-white',
                isSelected && 'ring-2 ring-slate-900 ring-offset-1',
                cell.inMonth && 'hover:brightness-95',
              )}
              onClick={() => props.onSelectDate(cell.date)}
            >
              <span className="font-medium">{cell.day}</span>
              {props.days && cell.inMonth ? (
                <span className="text-[9px] leading-tight sm:text-[10px]">
                  {source === 'override_unavailable' ? 'Off' : slotCount ? `${slotCount}` : '—'}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2 text-[10px] sm:text-xs">
        <LegendDot className={SOURCE_STYLES.recurring} label="Recurring" />
        <LegendDot className={SOURCE_STYLES.override} label="Override" />
        <LegendDot className={SOURCE_STYLES.override_unavailable} label="Unavailable" />
        <LegendDot className={SOURCE_STYLES.none} label="None" />
      </div>

      {selected ? (
        <div className="rounded-md border bg-slate-50 p-3 text-sm" data-testid="calendar-day-detail">
          <div className="font-medium">{selected.dateLabel ?? formatDateLong(selected.date)}</div>
          {selected.source === 'override_unavailable' ? (
            <p className="mt-1 text-slate-600">Unavailable due to override</p>
          ) : selected.slots.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selected.slots.map((t) => (
                <span key={t} className="rounded border bg-white px-1.5 py-0.5 font-mono text-xs">
                  {t}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-slate-600">No availability</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-600">Click a day to see appointment slots.</p>
      )}
    </div>
  )
}

function LegendDot(props: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={clsx('h-3 w-3 rounded border', props.className)} />
      {props.label}
    </span>
  )
}
