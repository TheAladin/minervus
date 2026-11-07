import { WarningIcon } from '../components/icons.jsx'
import { Button, EmptyState } from '../components/ui.jsx'

/** Replaces the whole app if rendering fails, so the screen is never left blank. */
export default function CrashPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl items-center justify-center px-4">
      <EmptyState
        level={1}
        icon={<WarningIcon className="size-8" />}
        title="Something went wrong"
        action={<Button onClick={() => window.location.reload()}>Reload the page</Button>}
      >
        Reloading the page may fix this.
      </EmptyState>
    </main>
  )
}
