import { useLocation } from 'react-router-dom'

import AuthForm from '../auth/AuthForm.jsx'
import { useAuth } from '../auth/useAuth.js'
import { TextLink } from '../components/ui.jsx'

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
          <TextLink to="/register" state={location.state}>
            Create an account
          </TextLink>
        </>
      }
    />
  )
}
