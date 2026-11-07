import { Link } from 'react-router-dom'

import { ExclamationIcon, Spinner } from './icons.jsx'

export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

const buttonBase = `inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full whitespace-nowrap transition-[background-color,color,transform,opacity,filter] duration-200 ease-out select-none active:scale-[0.97] disabled:pointer-events-none disabled:not-aria-busy:opacity-40 ${focusRing}`

const buttonSizes = {
  sm: 'h-8 px-3.5 text-footnote',
  md: 'h-10 px-[1.125rem] text-subhead',
  lg: 'h-12 px-6 text-body',
}

const buttonVariants = {
  primary: 'bg-accent font-medium text-white hover:bg-accent-hover',
  secondary: 'bg-fill font-medium text-ink hover:bg-fill-strong',
  // Gray with an accent label, like the App Store's buttons.
  tinted: 'bg-fill font-semibold text-link hover:bg-fill-strong',
  danger: 'bg-danger/10 font-medium text-danger hover:bg-danger/15',
  quiet: 'font-medium text-ink-muted hover:bg-fill hover:text-ink',
  quietDanger: 'font-medium text-ink-muted hover:bg-danger/10 hover:text-danger',
  ai: 'bg-linear-to-r from-indigo-600 via-violet-600 to-fuchsia-600 font-medium text-white hover:brightness-110',
  // For buttons that set their own text color and weight.
  surface: 'bg-surface shadow-card dark:shadow-none',
}

function buttonClasses(variant, size, className) {
  return `${buttonBase} ${buttonSizes[size]} ${buttonVariants[variant]} ${className}`
}

/** A button. `busy` disables it and shows a spinner, without fading it like a disabled one. */
export function Button({
  variant = 'primary',
  size = 'md',
  busy = false,
  disabled,
  className = '',
  children,
  ...props
}) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={buttonClasses(variant, size, className)}
      {...props}
    >
      {busy && <Spinner className="-ml-0.5 size-4" />}
      {children}
    </button>
  )
}

export function LinkButton({ variant = 'primary', size = 'md', className = '', ...props }) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />
}

const controlClasses = `block w-full rounded-xl bg-fill px-3.5 text-callout text-ink transition-[background-color,box-shadow] duration-200 placeholder:text-ink-faint hover:bg-fill-strong focus:bg-surface focus:inset-ring focus:inset-ring-accent focus:ring-4 focus:ring-accent/20 focus:outline-hidden disabled:opacity-50 aria-invalid:inset-ring aria-invalid:inset-ring-danger aria-invalid:focus:ring-danger/20`

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-footnote font-medium text-ink-muted">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block px-1 text-caption text-ink-muted">{hint}</span>}
    </label>
  )
}

export function Input({ className = '', ...props }) {
  return <input className={`${controlClasses} h-10 py-2 ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`${controlClasses} resize-y py-2.5 ${className}`} {...props} />
}

export function ErrorMessage({ children }) {
  if (!children) return null
  return (
    <p
      role="alert"
      className="flex animate-rise items-start gap-2 rounded-xl bg-danger/10 px-3.5 py-2.5 text-subhead text-danger"
    >
      <ExclamationIcon className="mt-px size-[1.125rem] shrink-0" />
      {children}
    </p>
  )
}

/** A spinner that only appears if loading takes a moment, so quick loads don't flash. */
export function Loading({ children = 'Loading…' }) {
  return (
    <div role="status" className="flex animate-fade-in justify-center py-24 [animation-delay:400ms]">
      <Spinner className="size-6 text-ink-muted" />
      <span className="sr-only">{children}</span>
    </div>
  )
}

const surface = 'rounded-2xl bg-surface shadow-card dark:shadow-none'

export function Panel({ className = '', ...props }) {
  return <div className={`${surface} p-5 sm:p-6 ${className}`} {...props} />
}

/** A rounded list of rows on a surface, like a grouped table. */
export function List({ divided = true, className = '', ...props }) {
  return (
    <ul
      className={`${surface} overflow-hidden ${divided ? 'divide-y divide-line' : ''} ${className}`}
      {...props}
    />
  )
}

/** Shows a failed load, with a way to try it again. */
export function LoadError({ error, onRetry }) {
  return (
    <div className="mx-auto max-w-md space-y-4 py-12 text-center">
      <ErrorMessage>{error.message}</ErrorMessage>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

export function TextLink({ className = '', ...props }) {
  return (
    <Link
      className={`rounded-sm font-medium text-link underline-offset-4 hover:underline ${focusRing} ${className}`}
      {...props}
    />
  )
}

export function BackLink({ to, children }) {
  return (
    <Link
      to={to}
      className={`group mb-3 -ml-1 inline-flex items-center gap-1 rounded-md px-1 text-subhead font-medium text-link ${focusRing}`}
    >
      <span className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span>{' '}
      {children}
    </Link>
  )
}

export function PageHeader({ title, subtitle, icon, children }) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-5">
      <div className="flex min-w-0 items-center gap-4">
        {icon}
        <div className="min-w-0">
          <h1 className="text-large-title font-bold break-words sm:text-[2.5rem]/[1.1]">{title}</h1>
          {subtitle && <p className="mt-1.5 text-subhead text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

/** A centered message with an icon, for empty and finished states. */
export function EmptyState({
  icon,
  iconClassName = 'bg-fill text-ink-muted',
  title,
  level = 2,
  children,
  action,
}) {
  const Heading = `h${level}`
  return (
    <div className="flex animate-rise flex-col items-center px-6 py-14 text-center">
      {icon && (
        <div className={`mb-5 grid size-16 place-items-center rounded-full ${iconClassName}`}>
          {icon}
        </div>
      )}
      {title && <Heading className="mb-2 text-title-2 font-semibold">{title}</Heading>}
      {children && <p className="max-w-sm text-subhead text-ink-muted">{children}</p>}
      {action && <div className="mt-7">{action}</div>}
    </div>
  )
}
