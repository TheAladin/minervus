import { createRoutesFromElements, Route } from 'react-router-dom'

import { PublicOnly, RequireAuth } from './auth/routes.jsx'
import Layout from './components/Layout.jsx'
import CrashPage from './pages/CrashPage.jsx'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'

export const routes = createRoutesFromElements(
  <Route element={<Layout />} errorElement={<CrashPage />}>
    <Route element={<PublicOnly />}>
      <Route path="login" element={<LoginPage />} />
      <Route path="register" element={<RegisterPage />} />
    </Route>
    <Route element={<RequireAuth />}>
      <Route index element={<HomePage />} />
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Route>,
)
