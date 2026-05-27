import { useEffect, useMemo, useState } from 'react'
import { Api, type OverrideType, type SlotsDay, type Staff, type WeeklyWindow } from '../api'
import { AvailabilityCalendar } from '../components/AvailabilityCalendar'
import { BulkWeeklyEditor } from '../components/BulkWeeklyEditor'
import { parseApiError } from '../lib/apiError'
import { monthStartEnd } from '../lib/calendar'
import { formatDateLong, formatTimeRange12h } from '../lib/format'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

type MobileTab = 'schedule' | 'slots'

function clsx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ')
}

export function AvailabilityPage() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null)
  const [weeklyWindows, setWeeklyWindows] = useState<WeeklyWindow[]>([])
  const [overrides, setOverrides] = useState<
    Array<{ id: number; staffId: number; date: string; type: OverrideType; windows: Array<{ startMin: number; endMin: number }> }>
  >([])

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mobileTab, setMobileTab] = useState<MobileTab>('schedule')
  const [seeding, setSeeding] = useState(false)

  const selectedStaff = useMemo(() => staff.find((s) => s.id === selectedStaffId) ?? null, [staff, selectedStaffId])

  async function refreshStaff() {
    const r = await Api.listStaff()
    setStaff(r.staff)
    if (r.staff.length && selectedStaffId == null) setSelectedStaffId(r.staff[0].id)
    if (!r.staff.length) setSelectedStaffId(null)
  }

  async function refreshStaffData(staffId: number) {
    const [w, o] = await Promise.all([Api.listWeeklyWindows(staffId), Api.listOverrides(staffId)])
    setWeeklyWindows(w.windows)
    setOverrides(o.overrides)
  }

  async function handleSeed() {
    setError(null)
    setSeeding(true)
    try {
      await Api.seed()
      const next = await Api.listStaff()
      setStaff(next.staff)
      const jane = next.staff.find((s) => s.name === 'Jane Smith')
      const pickId = jane?.id ?? next.staff[0]?.id ?? null
      setSelectedStaffId(pickId)
      if (pickId) await refreshStaffData(pickId)
    } catch (e) {
      setError(parseApiError(e))
    } finally {
      setSeeding(false)
    }
  }

  useEffect(() => {
    void refreshStaff().catch((e) => setError(parseApiError(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedStaffId) return
    setLoading(true)
    setError(null)
    void refreshStaffData(selectedStaffId)
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false))
  }, [selectedStaffId])

  return (
    <div className="space-y-4 sm:space-y-6">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</div>
      ) : null}

      <StaffToolbar
        staff={staff}
        selectedStaffId={selectedStaffId}
        onSelect={setSelectedStaffId}
        onCreated={refreshStaff}
        onSeed={handleSeed}
        seeding={seeding}
      />

      <MobileTabBar active={mobileTab} onChange={setMobileTab} />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
        {/* Schedule column */}
        <div className={clsx('space-y-4', mobileTab === 'slots' && 'hidden lg:block')}>
          <Card title="Weekly availability">
            {selectedStaff ? (
              <WeeklyPanel
                staffId={selectedStaff.id}
                windows={weeklyWindows}
                disabled={loading}
                onChanged={async () => refreshStaffData(selectedStaff.id)}
              />
            ) : (
              <EmptyState text="Add or select a staff member to configure weekly availability." />
            )}
          </Card>

          <Card title="Date overrides">
            {selectedStaff ? (
              <OverridesPanel
                staffId={selectedStaff.id}
                overrides={overrides}
                disabled={loading}
                onChanged={async () => refreshStaffData(selectedStaff.id)}
              />
            ) : (
              <EmptyState text="Add or select a staff member to configure overrides." />
            )}
          </Card>
        </div>

        {/* Slots column */}
        <div className={clsx(mobileTab === 'schedule' && 'hidden lg:block')}>
          <div className="lg:sticky lg:top-4">
            <Card title="Available appointment slots">
              {selectedStaff ? (
                <SlotsPanel staffId={selectedStaff.id} staffName={selectedStaff.name} />
              ) : (
                <EmptyState text="Add or select a staff member to view open slots." />
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function MobileTabBar(props: { active: MobileTab; onChange: (tab: MobileTab) => void }) {
  const tabs: Array<{ id: MobileTab; label: string }> = [
    { id: 'schedule', label: 'Schedule' },
    { id: 'slots', label: 'Slots' },
  ]
  return (
    <div className="flex rounded-lg border bg-white p-1 lg:hidden" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={props.active === t.id}
          className={clsx(
            'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            props.active === t.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50',
          )}
          onClick={() => props.onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function StaffToolbar(props: {
  staff: Staff[]
  selectedStaffId: number | null
  onSelect: (id: number | null) => void
  onCreated: () => Promise<void>
  onSeed: () => Promise<void>
  seeding: boolean
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function addStaff() {
    if (!name.trim()) return
    setErr(null)
    setBusy(true)
    try {
      const r = await Api.createStaff(name.trim())
      setName('')
      await props.onCreated()
      props.onSelect(r.staff.id)
    } catch (e) {
      setErr(parseApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-lg border bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="min-w-0 flex-1 text-xs font-medium text-slate-600">
          Staff member
          <select
            data-testid="staff-select"
            className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
            value={props.selectedStaffId ?? ''}
            onChange={(e) => {
              const v = e.target.value
              props.onSelect(v ? Number(v) : null)
            }}
          >
            <option value="">{props.staff.length ? 'Select staff…' : 'No staff yet'}</option>
            {props.staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          data-testid="seed-demo-data"
          className={clsx(
            'shrink-0 rounded-md border px-3 py-2 text-sm font-medium',
            props.seeding ? 'bg-slate-100 text-slate-400' : 'bg-white hover:bg-slate-50',
          )}
          disabled={props.seeding}
          onClick={() => void props.onSeed()}
        >
          {props.seeding ? 'Seeding…' : 'Seed demo data'}
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
          placeholder="Add new staff member"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) {
              e.preventDefault()
              void addStaff()
            }
          }}
        />
        <button
          type="button"
          className={clsx(
            'rounded-md px-4 py-2 text-sm font-medium sm:shrink-0',
            busy ? 'bg-slate-200 text-slate-500' : 'bg-slate-900 text-white hover:bg-slate-800',
          )}
          disabled={busy || !name.trim()}
          onClick={() => void addStaff()}
        >
          Add staff
        </button>
      </div>

      {err ? <div className="mt-2 text-xs text-red-700">{err}</div> : null}
    </section>
  )
}

function Card(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-white shadow-sm">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{props.title}</h2>
      </div>
      <div className="p-3 sm:p-4">{props.children}</div>
    </section>
  )
}

function EmptyState(props: { text: string }) {
  return <div className="text-sm text-slate-600">{props.text}</div>
}

function WeeklyPanel(props: { staffId: number; windows: WeeklyWindow[]; disabled: boolean; onChanged: () => Promise<void> }) {
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const grouped = useMemo(() => {
    const m = new Map<number, WeeklyWindow[]>()
    for (const w of props.windows) {
      const arr = m.get(w.dayOfWeek) ?? []
      arr.push(w)
      m.set(w.dayOfWeek, arr)
    }
    return m
  }, [props.windows])

  return (
    <div className="space-y-4">
      <BulkWeeklyEditor staffId={props.staffId} disabled={props.disabled} onChanged={props.onChanged} />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="text-xs text-slate-600">
          Day
          <select
            className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(Number(e.target.value))}
          >
            {DOW.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-600">
          Start
          <input
            className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </label>
        <label className="text-xs text-slate-600">
          End
          <input
            className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </label>
      </div>

      <button
        type="button"
        className={clsx(
          'w-full rounded-md px-3 py-2 text-sm font-medium',
          busy || props.disabled ? 'bg-slate-200 text-slate-500' : 'bg-slate-900 text-white hover:bg-slate-800',
        )}
        disabled={busy || props.disabled}
        onClick={async () => {
          setErr(null)
          setBusy(true)
          try {
            await Api.createWeeklyWindow({ staffId: props.staffId, dayOfWeek, startTime, endTime })
            await props.onChanged()
          } catch (e) {
            setErr(parseApiError(e))
          } finally {
            setBusy(false)
          }
        }}
      >
        Add weekly window
      </button>

      {err ? <div className="text-xs text-red-700">{err}</div> : null}

      <div className="max-h-[min(50vh,28rem)] space-y-2 overflow-y-auto pr-1">
        {DOW.map((label, i) => {
          const arr = grouped.get(i) ?? []
          return (
            <div key={label} className="rounded-md border" data-testid={`weekly-day-${i}`}>
              <div className="flex items-center justify-between border-b bg-slate-50 px-3 py-2">
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-slate-600">{arr.length ? `${arr.length} window(s)` : 'None'}</div>
              </div>
              <div className="divide-y">
                {arr.length ? (
                  arr.map((w) => (
                    <div key={w.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="font-mono">{formatTimeRange12h(w.startMin, w.endMin)}</span>
                      <button
                        type="button"
                        className="shrink-0 text-xs font-medium text-red-700 hover:underline"
                        onClick={async () => {
                          await Api.deleteWeeklyWindow(w.id)
                          await props.onChanged()
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-slate-600">No windows</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OverridesPanel(props: {
  staffId: number
  overrides: Array<{ id: number; staffId: number; date: string; type: OverrideType; windows: Array<{ startMin: number; endMin: number }> }>
  disabled: boolean
  onChanged: () => Promise<void>
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [type, setType] = useState<OverrideType>('unavailable')
  const [windows, setWindows] = useState<Array<{ startTime: string; endTime: string }>>([{ startTime: '10:00', endTime: '14:00' }])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-xs text-slate-600">
          Date
          <input
            className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="text-xs text-slate-600">
          Override type
          <select
            className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as OverrideType)}
          >
            <option value="unavailable">Unavailable all day</option>
            <option value="replace">Replace with custom windows</option>
            <option value="add">Add extra windows</option>
          </select>
        </label>
      </div>

      {(type === 'replace' || type === 'add') && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-700">Windows</div>
          <div className="space-y-2">
            {windows.map((w, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input
                  className="rounded-md border px-2 py-2 text-sm"
                  type="time"
                  value={w.startTime}
                  onChange={(e) => {
                    const next = windows.slice()
                    next[idx] = { ...w, startTime: e.target.value }
                    setWindows(next)
                  }}
                />
                <input
                  className="rounded-md border px-2 py-2 text-sm"
                  type="time"
                  value={w.endTime}
                  onChange={(e) => {
                    const next = windows.slice()
                    next[idx] = { ...w, endTime: e.target.value }
                    setWindows(next)
                  }}
                />
                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
                  onClick={() => setWindows((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
            onClick={() => setWindows((prev) => [...prev, { startTime: '17:00', endTime: '19:00' }])}
          >
            Add another window
          </button>
        </div>
      )}

      <button
        type="button"
        className={clsx(
          'w-full rounded-md px-3 py-2 text-sm font-medium',
          busy || props.disabled ? 'bg-slate-200 text-slate-500' : 'bg-slate-900 text-white hover:bg-slate-800',
        )}
        disabled={busy || props.disabled}
        onClick={async () => {
          setErr(null)
          setBusy(true)
          try {
            await Api.upsertOverride({
              staffId: props.staffId,
              date,
              type,
              windows: type === 'unavailable' ? undefined : windows,
            })
            await props.onChanged()
          } catch (e) {
            setErr(parseApiError(e))
          } finally {
            setBusy(false)
          }
        }}
      >
        Save override
      </button>

      {err ? <div className="text-xs text-red-700">{err}</div> : null}

      <div className="space-y-2">
        <div className="text-xs font-medium text-slate-700">Existing overrides</div>
        {props.overrides.length ? (
          <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {props.overrides.map((o) => (
              <div key={o.id} className="rounded-md border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 font-medium">
                    <div>{formatDateLong(o.date)}</div>
                    <span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{o.type}</span>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-medium text-red-700 hover:underline"
                    onClick={async () => {
                      await Api.deleteOverride(o.id)
                      await props.onChanged()
                    }}
                  >
                    Delete
                  </button>
                </div>
                {o.type === 'unavailable' ? (
                  <div className="mt-1 text-xs text-slate-600">Unavailable all day</div>
                ) : (
                  <div className="mt-1 text-xs text-slate-600">
                    {o.windows.map((w) => formatTimeRange12h(w.startMin, w.endMin)).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-600">No overrides yet.</div>
        )}
      </div>
    </div>
  )
}

type SlotsView = 'list' | 'calendar'

function SlotsPanel(props: { staffId: number; staffName: string }) {
  const [start, setStart] = useState('2026-05-25')
  const [end, setEnd] = useState('2026-05-29')
  const [durationMin, setDurationMin] = useState(30)
  const [days, setDays] = useState<SlotsDay[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [view, setView] = useState<SlotsView>('calendar')
  const [calendarMonth, setCalendarMonth] = useState({ year: 2026, monthIndex: 4 })
  const [selectedDate, setSelectedDate] = useState<string | null>('2026-05-25')

  async function fetchSlots(rangeStart: string, rangeEnd: string) {
    setErr(null)
    setBusy(true)
    try {
      const r = await Api.getSlots({ staffId: props.staffId, start: rangeStart, end: rangeEnd, durationMin })
      setDays(r.days)
    } catch (e) {
      setErr(parseApiError(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const { start, end } = monthStartEnd(calendarMonth.year, calendarMonth.monthIndex)
    void fetchSlots(start, end)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.staffId])

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600">
        Showing slots for <span className="font-medium text-slate-900">{props.staffName}</span>
      </p>

      <div className="flex rounded-lg border bg-slate-50 p-1" role="tablist">
        <button
          type="button"
          role="tab"
          data-testid="slots-view-calendar"
          className={clsx(
            'flex-1 rounded-md px-2 py-1.5 text-xs font-medium sm:text-sm',
            view === 'calendar' ? 'bg-white shadow-sm' : 'text-slate-600',
          )}
          onClick={() => {
            setView('calendar')
            const { start, end } = monthStartEnd(calendarMonth.year, calendarMonth.monthIndex)
            void fetchSlots(start, end)
          }}
        >
          Calendar
        </button>
        <button
          type="button"
          role="tab"
          data-testid="slots-view-list"
          className={clsx(
            'flex-1 rounded-md px-2 py-1.5 text-xs font-medium sm:text-sm',
            view === 'list' ? 'bg-white shadow-sm' : 'text-slate-600',
          )}
          onClick={() => setView('list')}
        >
          List
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-xs text-slate-600">
          Start
          <input
            className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="text-xs text-slate-600">
          End
          <input
            className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <label className="text-xs text-slate-600 sm:col-span-2">
          Duration
          <select
            className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
          >
            {[15, 30, 45, 60].map((d) => (
              <option key={d} value={d}>
                {d} minutes
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        data-testid="generate-slots"
        className={clsx(
          'w-full rounded-md px-3 py-2 text-sm font-medium',
          busy ? 'bg-slate-200 text-slate-500' : 'bg-slate-900 text-white hover:bg-slate-800',
        )}
        disabled={busy}
        onClick={() => {
          if (view === 'calendar') {
            const { start, end } = monthStartEnd(calendarMonth.year, calendarMonth.monthIndex)
            void fetchSlots(start, end)
          } else {
            void fetchSlots(start, end)
          }
        }}
      >
        {busy ? 'Loading…' : 'Generate slots'}
      </button>

      {err ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{err}</div> : null}

      {view === 'calendar' ? (
        <AvailabilityCalendar
          year={calendarMonth.year}
          monthIndex={calendarMonth.monthIndex}
          days={days}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onPrevMonth={() => {
            setCalendarMonth((m) => {
              const next = m.monthIndex === 0 ? { year: m.year - 1, monthIndex: 11 } : { year: m.year, monthIndex: m.monthIndex - 1 }
              const { start, end } = monthStartEnd(next.year, next.monthIndex)
              void fetchSlots(start, end)
              return next
            })
          }}
          onNextMonth={() => {
            setCalendarMonth((m) => {
              const next = m.monthIndex === 11 ? { year: m.year + 1, monthIndex: 0 } : { year: m.year, monthIndex: m.monthIndex + 1 }
              const { start, end } = monthStartEnd(next.year, next.monthIndex)
              void fetchSlots(start, end)
              return next
            })
          }}
        />
      ) : days ? (
        <div className="max-h-[min(60vh,32rem)] space-y-3 overflow-y-auto pr-1" data-testid="slots-list">
          {days.map((d) => (
            <div key={d.date} className="rounded-md border bg-white">
              <div className="flex flex-col gap-2 border-b bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-medium">{d.dateLabel ?? formatDateLong(d.date)}</div>
                <SourcePill source={d.source} />
              </div>
              <div className="px-3 py-2">
                {d.source === 'override_unavailable' ? (
                  <div className="text-sm text-slate-700">Unavailable due to override</div>
                ) : d.slots.length ? (
                  <div className="flex flex-wrap gap-2">
                    {d.slots.map((t) => (
                      <div key={t} className="rounded border bg-white px-2 py-1 font-mono text-sm">
                        {t}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-700">No availability</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-slate-600">Set a date range and click Generate slots.</div>
      )}
    </div>
  )
}

function SourcePill(props: { source: SlotsDay['source'] }) {
  const { source } = props
  const label =
    source === 'recurring'
      ? 'Recurring weekly'
      : source === 'override'
        ? 'Date override'
        : source === 'override_unavailable'
          ? 'Override: unavailable'
          : 'No availability'
  const style =
    source === 'recurring'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : source === 'override'
        ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
        : source === 'override_unavailable'
          ? 'bg-amber-50 text-amber-800 border-amber-200'
          : 'bg-slate-100 text-slate-700 border-slate-200'
  return <span className={clsx('w-fit rounded-full border px-2 py-0.5 text-xs', style)}>{label}</span>
}
