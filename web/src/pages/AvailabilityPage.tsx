import { useEffect, useMemo, useState } from 'react'
import { Api, type OverrideType, type SlotsDay, type Staff, type WeeklyWindow } from '../api'
import { parseApiError } from '../lib/apiError'
import { formatDateLong, formatTimeRange12h } from '../lib/format'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

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
    <div className="space-y-6">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-3">
        <Card title="Staff">
          <StaffPanel
            staff={staff}
            selectedStaffId={selectedStaffId}
            onSelect={setSelectedStaffId}
            onCreated={async () => {
              await refreshStaff()
            }}
          />
        </Card>

        <Card title="Weekly availability">
          {selectedStaff ? (
            <WeeklyPanel
              staffId={selectedStaff.id}
              windows={weeklyWindows}
              disabled={loading}
              onChanged={async () => refreshStaffData(selectedStaff.id)}
            />
          ) : (
            <EmptyState text="Create a staff member to configure weekly availability." />
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
            <EmptyState text="Create a staff member to add overrides." />
          )}
        </Card>
      </div>

      <Card title="Available appointment slots">
        {selectedStaff ? (
          <SlotsPanel staffId={selectedStaff.id} />
        ) : (
          <EmptyState text="Create and select a staff member to view open slots." />
        )}
      </Card>
    </div>
  )
}

function Card(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-white shadow-sm">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{props.title}</h2>
      </div>
      <div className="p-4">{props.children}</div>
    </section>
  )
}

function EmptyState(props: { text: string }) {
  return <div className="text-sm text-slate-600">{props.text}</div>
}

function StaffPanel(props: {
  staff: Staff[]
  selectedStaffId: number | null
  onSelect: (id: number) => void
  onCreated: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="New staff name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className={clsx(
            'rounded-md px-3 py-2 text-sm font-medium',
            busy ? 'bg-slate-200 text-slate-500' : 'bg-slate-900 text-white hover:bg-slate-800',
          )}
          disabled={busy}
          onClick={async () => {
            setErr(null)
            setBusy(true)
            try {
              await Api.createStaff(name)
              setName('')
              await props.onCreated()
            } catch (e) {
              setErr(parseApiError(e))
            } finally {
              setBusy(false)
            }
          }}
        >
          Add
        </button>
      </div>

      {err ? <div className="text-xs text-red-700">{err}</div> : null}

      <div className="space-y-1">
        {props.staff.length ? (
          props.staff.map((s) => (
            <button
              key={s.id}
              className={clsx(
                'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm',
                props.selectedStaffId === s.id ? 'border-slate-900 bg-slate-50' : 'hover:bg-slate-50',
              )}
              onClick={() => props.onSelect(s.id)}
            >
              <span className="font-medium">{s.name}</span>
              <span className="text-xs text-slate-500">#{s.id}</span>
            </button>
          ))
        ) : (
          <div className="text-sm text-slate-600">No staff yet.</div>
        )}
      </div>
    </div>
  )
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

      <div className="space-y-3">
        {DOW.map((label, i) => {
          const arr = grouped.get(i) ?? []
          return (
            <div key={label} className="rounded-md border">
              <div className="flex items-center justify-between border-b bg-slate-50 px-3 py-2">
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-slate-600">{arr.length ? `${arr.length} window(s)` : 'None'}</div>
              </div>
              <div className="divide-y">
                {arr.length ? (
                  arr.map((w) => (
                    <div key={w.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div>
                        <span className="font-mono">
                          {formatTimeRange12h(w.startMin, w.endMin)}
                        </span>
                      </div>
                      <button
                        className="text-xs font-medium text-red-700 hover:underline"
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
                  className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
                  onClick={() => setWindows((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
            onClick={() => setWindows((prev) => [...prev, { startTime: '17:00', endTime: '19:00' }])}
          >
            Add another window
          </button>
        </div>
      )}

      <button
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
          <div className="space-y-2">
            {props.overrides.map((o) => (
              <div key={o.id} className="rounded-md border px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {formatDateLong(o.date)}{' '}
                    <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{o.type}</span>
                  </div>
                  <button
                    className="text-xs font-medium text-red-700 hover:underline"
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

function SlotsPanel(props: { staffId: number }) {
  const today = new Date().toISOString().slice(0, 10)
  const [start, setStart] = useState(today)
  const [end, setEnd] = useState(today)
  const [durationMin, setDurationMin] = useState(30)
  const [days, setDays] = useState<SlotsDay[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
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
        <label className="text-xs text-slate-600">
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
        <div className="flex items-end">
          <button
            className={clsx(
              'w-full rounded-md px-3 py-2 text-sm font-medium',
              busy ? 'bg-slate-200 text-slate-500' : 'bg-slate-900 text-white hover:bg-slate-800',
            )}
            disabled={busy}
            onClick={async () => {
              setErr(null)
              setBusy(true)
              try {
                const r = await Api.getSlots({ staffId: props.staffId, start, end, durationMin })
                setDays(r.days)
              } catch (e) {
                setErr(parseApiError(e))
              } finally {
                setBusy(false)
              }
            }}
          >
            Generate
          </button>
        </div>
      </div>

      {err ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{err}</div> : null}

      {days ? (
        <div className="space-y-3">
          {days.map((d) => (
            <div key={d.date} className="rounded-md border bg-white">
              <div className="flex items-center justify-between border-b bg-slate-50 px-3 py-2">
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
        <div className="text-sm text-slate-600">Select inputs and click Generate.</div>
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
  return <span className={clsx('rounded-full border px-2 py-0.5 text-xs', style)}>{label}</span>
}

