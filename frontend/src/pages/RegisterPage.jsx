import { Link, useLocation } from 'react-router-dom'

import AuthForm from '../auth/AuthForm.jsx'
import { useAuth } from '../auth/useAuth.js'

export default function RegisterPage() {
  const { register } = useAuth()
  const location = useLocation()

  return (
    <AuthForm
      title="Create your account"
      submitLabel="Create account"
      onSubmit={register}
      passwordAutoComplete="new-password"
      passwordHint="At least 8 characters."
      minPasswordLength={8}
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            state={location.state}
            className="font-medium underline underline-offset-4"
          >
            Log in
          </Link>
        </>
      }
    />
  )
}
