import { Link, useLocation } from 'react-router-dom'

import AuthForm from '../auth/AuthForm.jsx'
import { useAuth } from '../auth/useAuth.js'

export default function LoginPage() {
  const { login } = useAuth()
  const location = useLocation()

  return (
    <AuthForm
      title="Log in"
      submitLabel="Log in"
      onSubmit={login}
      passwordAutoComplete="current-password"
      footer={
        <>
          New to Minervus?{' '}
          <Link
            to="/register"
            state={location.state}
            className="font-medium underline underline-offset-4"
          >
            Create an account
          </Link>
        </>
      }
    />
  )
}
