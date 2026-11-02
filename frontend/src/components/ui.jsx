const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900'

const buttonBase = `inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`

const buttonVariants = {
  primary: 'border-stone-900 bg-stone-900 text-white hover:border-stone-700 hover:bg-stone-700',
  secondary: 'border-stone-300 bg-white text-stone-800 hover:bg-stone-100',
  danger: 'border-red-200 bg-white text-red-700 hover:bg-red-50',
  quiet: 'border-transparent text-stone-600 hover:bg-stone-100 hover:text-stone-900',
}

export function Button({ variant = 'primary', className = '', ...props }) {
  return (
    <button
      type="button"
      className={`${buttonBase} ${buttonVariants[variant]} ${className}`}
      {...props}
    />
  )
}

const controlClasses = `block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm placeholder:text-stone-400 disabled:bg-stone-100 ${focusRing}`

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  )
}

export function Input({ className = '', ...props }) {
  return <input className={`${controlClasses} ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`${controlClasses} ${className}`} {...props} />
}

export function ErrorMessage({ children }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {children}
    </p>
  )
}

export function Loading({ children = 'Loading…' }) {
  return (
    <p role="status" className="text-sm text-stone-500">
      {children}
    </p>
  )
}

export function Panel({ className = '', ...props }) {
  return <div className={`rounded-lg border border-stone-200 bg-white p-4 sm:p-5 ${className}`} {...props} />
}

/** Shows a failed load, with a way to try it again. */
export function LoadError({ error, onRetry }) {
  return (
    <div className="space-y-3">
      <ErrorMessage>{error.message}</ErrorMessage>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-serif text-3xl font-semibold tracking-tight break-words">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
