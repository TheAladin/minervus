import { useLocation } from 'react-router-dom'

import AuthForm from '../auth/AuthForm.jsx'
import { useAuth } from '../auth/useAuth.js'
import { TextLink } from '../components/ui.jsx'

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
          <TextLink to="/login" state={location.state}>
            Log in
          </TextLink>
        </>
      }
    />
  )
}
