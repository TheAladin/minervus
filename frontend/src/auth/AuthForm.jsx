import { useState } from 'react'

import { Button, ErrorMessage, Field, Input } from '../components/ui.jsx'
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
    <div className="mx-auto mt-4 max-w-sm sm:mt-12">
      <h1 className="mb-6 font-serif text-3xl font-semibold tracking-tight">{title}</h1>
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
        <Button type="submit" disabled={pending} className="w-full">
          {submitLabel}
        </Button>
      </form>
      <p className="mt-6 text-sm text-stone-600">{footer}</p>
    </div>
  )
}
