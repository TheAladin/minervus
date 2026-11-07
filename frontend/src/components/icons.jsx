import { useId } from 'react'

function Icon({ className = 'size-5', children, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {children}
    </svg>
  )
}

export function AppIcon({ className = 'size-8' }) {
  const id = useId()
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4d9bff" />
          <stop offset="1" stopColor="#6b4dff" />
        </linearGradient>
      </defs>
      <path d="M32 0C6.4 0 0 6.4 0 32s6.4 32 32 32 32-6.4 32-32S57.6 0 32 0Z" fill={`url(#${id})`} />
      <rect
        x="15"
        y="16"
        width="25"
        height="31"
        rx="5"
        fill="#fff"
        fillOpacity="0.45"
        transform="rotate(-11 27.5 31.5)"
      />
      <rect x="24" y="17" width="25" height="31" rx="5" fill="#fff" transform="rotate(7 36.5 32.5)" />
    </svg>
  )
}

export function Spinner({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`animate-spinner ${className}`}>
      {Array.from({ length: 8 }, (_, spoke) => (
        <rect
          key={spoke}
          x="11"
          y="2"
          width="2"
          height="6"
          rx="1"
          fill="currentColor"
          opacity={1 - ((8 - spoke) % 8) * 0.11}
          transform={`rotate(${spoke * 45} 12 12)`}
        />
      ))}
    </svg>
  )
}

export function PlayIcon(props) {
  return (
    <Icon fill="currentColor" stroke="none" {...props}>
      <path d="M8 5.7v12.6a1.1 1.1 0 0 0 1.68.94l10.1-6.3a1.1 1.1 0 0 0 0-1.88L9.68 4.76A1.1 1.1 0 0 0 8 5.7Z" />
    </Icon>
  )
}

export function SparklesIcon(props) {
  return (
    <Icon fill="currentColor" stroke="none" {...props}>
      <path d="M10 3.5q1.3 7.2 8.5 8.5-7.2 1.3-8.5 8.5-1.3-7.2-8.5-8.5Q8.7 10.7 10 3.5Z" />
      <path d="M18.5 2q.5 2.7 3.2 3.2-2.7.5-3.2 3.2-.5-2.7-3.2-3.2 2.7-.5 3.2-3.2Z" />
    </Icon>
  )
}

export function PlusIcon(props) {
  return (
    <Icon strokeWidth="2" {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function CheckIcon(props) {
  return (
    <Icon strokeWidth="2.25" {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icon>
  )
}

export function ExclamationIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.25" />
      <circle cx="12" cy="16.25" r="0.4" fill="currentColor" />
    </Icon>
  )
}

export function WarningIcon(props) {
  return (
    <Icon {...props}>
      <path d="M10.27 4.4 2.84 17.3A2 2 0 0 0 4.57 20.3h14.86a2 2 0 0 0 1.73-3L13.73 4.4a2 2 0 0 0-3.46 0Z" />
      <path d="M12 9.5v4" />
      <circle cx="12" cy="16.75" r="0.4" fill="currentColor" />
    </Icon>
  )
}

export function DocumentIcon(props) {
  return (
    <Icon {...props}>
      <path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8l-5-5Z" />
      <path d="M14 3v3.5A1.5 1.5 0 0 0 15.5 8H19M9 13h6M9 16.5h4" />
    </Icon>
  )
}

export function CardsIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="7.5" width="14" height="13" rx="2.5" />
      <path d="M7 4.5h11a2.5 2.5 0 0 1 2.5 2.5v9.5" />
    </Icon>
  )
}

export function ClockIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  )
}

export function SearchIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </Icon>
  )
}
