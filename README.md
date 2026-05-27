# Availability Scheduler (Interview Project)

Fullstack app to manage staff availability (recurring weekly + date overrides) and generate available appointment start times for a date range.

## Stack

- Frontend: React + TypeScript + Tailwind (Vite)
- Backend: Node + Express + TypeScript
- Persistence: SQLite (`server/data.sqlite` via `better-sqlite3`)
- Tests: Vitest (scheduling unit tests, API integration tests via supertest, frontend helpers)

## Setup / run locally

Prereqs: Node 18+ recommended.

Install deps:

```bash
cd web && npm install
cd ../server && npm install
cd .. && npm install
```

Run both API + web:

```bash
npm run dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:5174`

Run tests:

```bash
npm test
```

## Data model

- **Staff**: `staff(id, name)`
- **Weekly windows**: `weekly_windows(staff_id, day_of_week, start_min, end_min)`
- **Overrides**: `overrides(staff_id, date, type)`
  - `type` is one of:
    - `unavailable`: unavailable all day
    - `replace`: ignore weekly windows and use override windows
    - `add`: take weekly windows and add extra windows for that date
- **Override windows**: `override_windows(override_id, start_min, end_min)`

Times are stored as **minutes from midnight** to keep scheduling logic simple and testable.

## Scheduling logic (how slots are generated)

Inputs: staff member, start date, end date, appointment duration minutes.

For each date in the range (inclusive):

1. Start with weekly windows for that weekday.
2. If a date override exists:
   - `unavailable`: no windows; source is `override_unavailable`
   - `replace`: windows become the override windows; source is `override`
   - `add`: weekly + override windows are merged; source is `override`
3. Slots are generated per window by stepping forward by `durationMin` while `start + durationMin <= end`.

The UI shows the **source** for each day: recurring, override, override-unavailable, or none.

## Validation / business rules

The API rejects:

- End time before start time
- Overlapping windows on the same day (weekly windows)
- **`add` overrides that overlap recurring weekly windows** for that weekday
- Empty override windows for `replace` / `add`
- Invalid appointment duration (<= 0) for slot generation
- Slot queries where **start date is after end date** or dates are not `YYYY-MM-DD`

API errors are returned as `{ "error": "human-readable message" }`.

## Assumptions

- Times are treated as **local time** (no timezone conversions).
- Slots are aligned to the window start and the chosen duration (e.g., 9:00–10:00 with 45 min gives only 9:00).
- Overrides are **upserted by (staffId, date)** (saving again updates that date’s override).

## Tradeoffs (time-boxed)

- No edit-in-place UI for weekly windows; you add/delete windows instead.
- No bulk weekly availability editor.
- Minimal styling beyond clean Tailwind layout.

## AI usage

- Tools used: Cursor agent + an LLM for scaffolding and validation/test patterns.
- Used for: outlining the data model, drafting the scheduling function signatures, and generating initial test cases.
- Suggestion changed/rejected: I avoided adding a heavy ORM/migration tool (e.g. Prisma) to keep setup fast and the scheduling logic front-and-center.
- Issue identified manually: Tailwind v4 CLI mismatch on this environment; pinned Tailwind to v3 for stable `tailwindcss init`.
- Least confident area: timezone handling and DST behavior (intentionally treated as local wall-clock time).

