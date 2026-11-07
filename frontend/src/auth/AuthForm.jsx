import { useState } from 'react'

import { AppIcon } from '../components/icons.jsx'
import { Button, ErrorMessage, Field, Input, Panel } from '../components/ui.jsx'
import { useAction } from '../hooks/useAction.js'

export default function AuthForm({
  title,
  submitLabel,
  onSubmit,
  passwordAutoComplete,
  passwordHint,
  minPasswordLength,
  footer,
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { run, pending, error } = useAction()

  function handleSubmit(event) {
    event.preventDefault()
    // A success changes the signed-in user, and the route then redirects away.
    run(() => onSubmit({ email, password }))
  }

  return (
    <div className="mx-auto max-w-sm animate-rise pt-2 sm:pt-8">
      <AppIcon className="mx-auto mb-5 size-14 drop-shadow-[0_6px_16px_rgb(77_110_255/0.35)]" />
      <h1 className="mb-7 text-center text-title-1 font-bold">{title}</h1>
      <Panel>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Email">
            <Input
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field label="Password" hint={passwordHint}>
            <Input
              type="password"
              name="password"
              autoComplete={passwordAutoComplete}
              required
              minLength={minPasswordLength}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <ErrorMessage>{error}</ErrorMessage>
          <Button type="submit" size="lg" busy={pending} className="mt-2 w-full">
            {submitLabel}
          </Button>
        </form>
      </Panel>
      <p className="mt-6 text-center text-subhead text-ink-muted">{footer}</p>
    </div>
  )
}
