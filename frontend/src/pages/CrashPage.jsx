import { Button } from '../components/ui.jsx'

/** Replaces the whole app if rendering fails, so the screen is never left blank. */
export default function CrashPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="mb-2 font-serif text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mb-6 text-sm text-stone-500">Reloading the page may fix this.</p>
      <Button onClick={() => window.location.reload()}>Reload the page</Button>
    </main>
  )
}
