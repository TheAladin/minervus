import { createRoutesFromElements, Route } from 'react-router-dom'

import { PublicOnly, RequireAuth } from './auth/routes.jsx'
import Layout from './components/Layout.jsx'
import CrashPage from './pages/CrashPage.jsx'
import DeckPage from './pages/DeckPage.jsx'
import DecksPage from './pages/DecksPage.jsx'
import GeneratePage from './pages/GeneratePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import StudyPage from './pages/StudyPage.jsx'

export const routes = createRoutesFromElements(
  <Route element={<Layout />} errorElement={<CrashPage />}>
    <Route element={<PublicOnly />}>
      <Route path="login" element={<LoginPage />} />
      <Route path="register" element={<RegisterPage />} />
    </Route>
    <Route element={<RequireAuth />}>
      <Route index element={<DecksPage />} />
      <Route path="decks/:deckId" element={<DeckPage />} />
      <Route path="decks/:deckId/study" element={<StudyPage />} />
      <Route path="decks/:deckId/generate" element={<GeneratePage />} />
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Route>,
)
