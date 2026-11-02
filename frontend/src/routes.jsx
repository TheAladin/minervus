import { createRoutesFromElements, Route } from 'react-router-dom'

import Layout from './components/Layout.jsx'
import CrashPage from './pages/CrashPage.jsx'
import HomePage from './pages/HomePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

export const routes = createRoutesFromElements(
  <Route element={<Layout />} errorElement={<CrashPage />}>
    <Route index element={<HomePage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Route>,
)
