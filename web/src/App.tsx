import { AvailabilityPage } from './pages/AvailabilityPage'

export function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="text-lg font-semibold">Availability Scheduler</div>
          <div className="text-sm text-slate-600">Admin</div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <AvailabilityPage />
      </main>
    </div>
  )
}

