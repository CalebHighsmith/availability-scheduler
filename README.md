# Staff Availability Scheduler

A fullstack admin app for managing staff availability and generating bookable appointment start times. Built as a take-home project for a **Fullstack Engineer** role.

Care teams can define **recurring weekly hours**, apply **date-specific overrides** (PTO, shortened days, extra hours), and preview **open slots** for a date range and appointment length.

---

## Features (mapped to requirements)

| Requirement | Implementation |
|-------------|----------------|
| Create staff members | Staff dropdown + add form |
| Recurring weekly availability (multiple windows/day) | Per-day windows + **bulk weekly editor** |
| Date overrides (`unavailable` / `replace` / `add`) | Overrides panel with upsert by date |
| View slots for staff + date range + duration | Slots panel (15 / 30 / 45 / 60 min) |
| Invalid window handling | API validation + friendly UI errors |
| Show availability **source** per day | Pills + calendar colors + list labels |
| Persistence across refresh | SQLite (`server/data.sqlite`) |

**Also included (nice-to-haves):**

- **Calendar UI** — month view with source colors and per-day slot detail
- **Bulk weekly editor** — apply the same hours to multiple weekdays at once
- **Seed demo data** — one-click sample data (Jane Smith + PDF example overrides)
- **Tests** — scheduling unit tests, API integration tests, Playwright E2E

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | React 19, TypeScript, Tailwind CSS, Vite |
| Backend | Node.js, Express 5, TypeScript |
| Database | SQLite via `better-sqlite3` |
| Validation | Zod (API), custom scheduling validators |
| Tests | Vitest, Supertest, Playwright |

---

## Quick start

**Prerequisites:** Node.js 18+

```bash
# Install dependencies (root, server, web)
cd web && npm install
cd ../server && npm install
cd .. && npm install

# Run API + frontend
npm run dev
```

| Service | URL |
|---------|-----|
| Web UI | http://localhost:5173 |
| API | http://localhost:5174 |

**Demo flow**

1. Open the web UI → click **Seed demo data**
2. Select **Jane Smith**
3. Go to **Slots** → **Calendar** → **Generate slots**
4. Click **Monday, May 25, 2026** to see `9:00 AM` / `9:30 AM` slots

Or seed via API:

```bash
curl -X POST http://localhost:5174/api/seed
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + web (concurrently) |
| `npm run build` | Production build (server + web) |
| `npm test` | Unit + integration tests |
| `npm run test:e2e` | Playwright end-to-end tests |

**E2E setup (first time only):**

```bash
npx playwright install chromium
npm run test:e2e
```

Playwright reuses an existing dev server on port `5173` when one is already running.

---

## Project structure

```
├── e2e/                    # Playwright tests
├── server/
│   ├── src/
│   │   ├── scheduling.ts   # Core slot-generation logic (pure, tested)
│   │   ├── app.ts          # Express routes
│   │   ├── db.ts           # SQLite schema + migrations
│   │   └── validation.ts   # Zod schemas
│   └── test/               # Vitest (scheduling + API)
├── web/
│   └── src/
│       ├── pages/AvailabilityPage.tsx
│       ├── components/     # Calendar, bulk weekly editor
│       └── api.ts          # API client
└── playwright.config.ts
```

---

## Data model

```
staff
  └── weekly_windows (day_of_week, start_min, end_min)
  └── overrides (date, type)
        └── override_windows (start_min, end_min)
```

Times are stored as **minutes from midnight** (`540` = 9:00 AM).

### Override semantics

| Type | Behavior |
|------|----------|
| `unavailable` | No availability for that date (ignores weekly) |
| `replace` | Only override windows apply for that date |
| `add` | Weekly windows **plus** extra override windows (must not overlap weekly) |

Overrides are **upserted** by `(staffId, date)` — saving again replaces that day's override.

---

## Scheduling logic

For each date in `[start, end]` (inclusive):

1. Load recurring windows for that **weekday**.
2. Apply any **date override** (see table above).
3. Generate slot start times: step by `durationMin` while `start + durationMin ≤ window end`.

Example: available `9:00 AM–10:00 AM`, duration **30 min** → slots at `9:00 AM`, `9:30 AM`.

The API returns each day with:

- `dateLabel` — e.g. `Monday, May 25`
- `source` — `recurring` \| `override` \| `override_unavailable` \| `none`
- `slots` — 12-hour times, e.g. `9:00 AM`

Core logic lives in `server/src/scheduling.ts` and is covered by unit tests.

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/seed` | Idempotent demo data |
| `GET/POST` | `/api/staff` | List / create staff |
| `GET/POST` | `/api/weekly-windows` | List / create one window |
| `POST` | `/api/weekly-windows/bulk` | Bulk create for multiple days |
| `DELETE` | `/api/weekly-windows/:id` | Remove window |
| `GET/POST` | `/api/overrides` | List / upsert override |
| `DELETE` | `/api/overrides/:id` | Remove override |
| `GET` | `/api/slots?staffId&start&end&durationMin` | Generate appointment slots |

Errors: `{ "error": "human-readable message" }`

---

## Validation & business rules

The API rejects:

- End time before start time
- Overlapping windows on the same day
- Empty override windows for `replace` / `add`
- `add` overrides that overlap recurring weekly windows
- Invalid dates or `start > end` on slot queries
- Appointment duration ≤ 0

---

## Assumptions

- All times are **local wall-clock** (no timezone or DST handling).
- Slots align to window starts at the chosen interval (no arbitrary offsets).
- One admin user (no authentication), per project scope.

---

## Tradeoffs

| Decision | Rationale |
|----------|-----------|
| SQLite file DB | Fast local setup, meets persistence requirement |
| Scheduling logic on server | Single source of truth; frontend is a thin client |
| No ORM | Keeps focus on scheduling rules and testability |
| Add/delete windows vs inline edit | Simpler UI within time budget |
| `reuseExistingServer` in Playwright | Smoother local dev when port 5173 is already in use |

---

## Evaluation checklist (self-assessment)

- [x] End-to-end availability workflow
- [x] Correct slot generation (recurring + overrides + duration)
- [x] Clear data model and README
- [x] Business-rule validation
- [x] Usable frontend (responsive, calendar, source labels)
- [x] Organized, testable code
- [x] Automated tests (unit, API, E2E)

---

## License

MIT (interview submission — use as reference only unless otherwise specified).
